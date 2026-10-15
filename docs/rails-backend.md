# The Rails backend

This template is the desktop half of a pair. The other half is
[compound-stack-rails](https://github.com/kieranklaassen/compound-stack-rails):
Rails owns accounts, data and the published builds, and the Electron app is a
client that signs in to it.

The two meet on one small JSON surface under `/device`. Everything else the
Rails app serves is for browsers.

**State of this document.** The Electron side below is code in this repository
and is tested against stand-ins. The Rails side is a sketch: compound-stack-rails
(0.8.1 when this was written) ships no `/device` endpoints. The Ruby here shows
the shape to build, and has not been run. Treat it as a plan for a `desktop`
module of the Rails stack, not as a file to copy blind.

## How the two fit

| Concern | Rails (compound-stack-rails) | Electron (this template) |
| --- | --- | --- |
| Accounts | Users, sessions, the sign-in page | Holds one device token, in the shell |
| Sign-in | Device grant: three endpoints and an approve page | `shell/account.mjs` |
| Pages | Inertia pages, props from controllers | Its own page, built into the app, no Rails props |
| Data | The database, and a JSON door per thing a device syncs | Asks through `shell/server.mjs`, never from the page |
| Files | Presigned addresses to a bucket | Moves the bytes itself, shell only |
| Updates | Names the newest build, signs its address | `shell/updater.mjs` looks, fetches, checks, exchanges |
| Deep links | A plain `<a href="compound://open/42">` on a page | `shell/app-link.mjs` reads the id |
| Agents | Server tools (the Rails `webmcp` module) | Page tools (`page/agent/`) |

Rails' rule is "no parallel JSON API: a page never fetches its own data". The
device surface is the sanctioned exception, and it stays small: a desktop app is
not a page, has no cookie, and cannot be handed props.

## What signs a request in

A browser has a session cookie. The desktop app has a **device token**, sent as
`Authorization: Bearer <token>`. Neither stands in for the other: `/device/**`
never answers a cookie, and no page answers a device token.

The token lives in the shell (`shell/vault.mjs`, encrypted with the system's
keychain through `safeStorage`). The page never sees it. The shell sends it to
one origin, the server the build was set to (`shell/server.mjs`): https, or
plain http on this machine for development. No redirect is followed.

## The wire

This is what `shell/account.mjs` and `shell/update-look.mjs` ask and accept.
Build the Rails side to it.

| Request | Signed by | Answer |
| --- | --- | --- |
| `POST /device/authorizations` | nothing | `201 { device_code, user_code, interval, expires_in }` |
| `POST /device/authorizations/token` with `{ device_code }` | nothing | `200 { token, email }`, or `428 { error: "authorization_pending" }`, `428 { error: "slow_down" }`, `400 { error: "access_denied" }`, `400 { error: "expired_token" }` |
| `GET /device` | device token | `200 { email }`, or `401` |
| `DELETE /device` | device token | `204` (the token is ended) |
| `GET /device/update` | device token | `200 { update: null }` or `200 { update: { version, size, sha256, url } }`, or `401` |
| `GET /device/approve` | session cookie | The approve page (a page, not JSON) |

Shapes the app holds the answers to, and refuses otherwise:

- `user_code` is `XXXX-XXXX`, capitals and digits. `device_code` is 20 to 200
  URL-safe characters. `interval` is seconds, 1 to 30. `expires_in` is at most 900.
- `version` is `1.2.3`. `size` is bytes, at most 2 GiB. `sha256` is 64 hex
  characters. `url` is https.
- Only a strictly higher version is an update.

## Signing in: the device grant

The app never shows a password field. It shows a short code and opens the
browser, where the person is already signed in.

1. The app posts to `/device/authorizations` and is answered a long
   `device_code` (kept in the shell) and a short `user_code` (shown in the app).
2. The app opens `https://your-app/device/approve#ABCD-EFGH` in the browser.
   The code is after the `#`, so it is in no server log.
3. The approve page reads the code from the fragment, shows it, and the person
   presses Approve or Refuse. They compare it with the code in the app.
4. The app polls `/device/authorizations/token` with the device code. When the
   request was approved, it is handed the token once.

### Rails sketch

```ruby
# db/migrate/..._create_device_authorizations.rb
create_table :device_authorizations do |t|
  t.string :device_code_digest, null: false, index: { unique: true }
  t.string :user_code_digest, null: false, index: { unique: true }
  t.references :user, foreign_key: true          # set when approved
  t.string :state, null: false, default: "pending" # pending, approved, refused, claimed
  t.string :app_name
  t.datetime :expires_at, null: false
  t.datetime :last_polled_at
  t.timestamps
end
```

```ruby
class DeviceAuthorization < ApplicationRecord
  LIFE = 10.minutes
  INTERVAL = 5
  ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars # no 0/O, 1/I

  belongs_to :user, optional: true

  # Answers [record, device_code, user_code]. Only digests are kept.
  def self.start(app_name:)
    device_code = SecureRandom.urlsafe_base64(32)
    user_code = Array.new(8) { ALPHABET.sample(random: SecureRandom) }.each_slice(4).map(&:join).join("-")
    record = create!(
      device_code_digest: digest(device_code),
      user_code_digest: digest(user_code),
      app_name: app_name.to_s.first(60),
      expires_at: LIFE.from_now
    )
    [record, device_code, user_code]
  end

  def self.digest(code) = OpenSSL::Digest::SHA256.hexdigest(code.to_s)
  def self.pending_with(user_code) = where(state: "pending").where("expires_at > ?", Time.current).find_by(user_code_digest: digest(user_code))

  def approve!(user) = update!(user: user, state: "approved")
  def refuse! = update!(state: "refused")

  # The token is handed over once: approved becomes claimed in the same statement.
  def claim!
    claimed = self.class.where(id: id, state: "approved").update_all(state: "claimed")
    claimed == 1 ? user.sessions.create!(device: true).then { |session| [session, session.device_token] } : nil
  end
end
```

```ruby
module Device
  class BaseController < ActionController::API
    before_action :require_device

    private

    # A bearer token and nothing else: no cookie is ever read here.
    def require_device
      token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
      @device_session = token && Session.find_by_device_token(token)
      head :unauthorized unless @device_session
    end

    def current_user = @device_session.user
  end
end

class Device::AuthorizationsController < ActionController::API
  rate_limit to: 10, within: 1.minute, only: :create

  def create
    _record, device_code, user_code = DeviceAuthorization.start(app_name: request.user_agent)
    render status: :created, json: {
      device_code:, user_code:, interval: DeviceAuthorization::INTERVAL, expires_in: DeviceAuthorization::LIFE.to_i
    }
  end

  def token
    record = DeviceAuthorization.find_by(device_code_digest: DeviceAuthorization.digest(params[:device_code]))
    return render(status: :bad_request, json: { error: "expired_token" }) if record.nil? || record.expires_at.past?
    return render(status: :bad_request, json: { error: "access_denied" }) if record.state == "refused"
    return render(status: 428, json: { error: "slow_down" }) if record.last_polled_at&.after?(2.seconds.ago)

    record.touch(:last_polled_at)
    session, token = record.claim!
    return render(status: 428, json: { error: "authorization_pending" }) unless session

    render json: { token:, email: session.user.email_address }
  end
end

class DevicesController < Device::BaseController
  def show = render(json: { email: current_user.email_address })
  def destroy = @device_session.destroy!.then { head :no_content }
end
```

The approve page is an ordinary Inertia page behind the cookie sign-in, with
two forms held to the forgery token:

```ruby
class Device::ApprovalsController < InertiaController
  def show = render(inertia: "device/approve")   # the page reads the code from location.hash

  def create
    record = DeviceAuthorization.pending_with(params[:user_code])
    return redirect_to(device_approve_path, alert: "That code is not waiting. Start the sign-in again in the app.") unless record

    params[:refuse] ? record.refuse! : record.approve!(Current.user)
    redirect_to device_approve_path, notice: params[:refuse] ? "Refused." : "Approved. Go back to the app."
  end
end
```

```ruby
# config/routes.rb
resource :device, only: %i[show destroy]
namespace :device do
  resources :authorizations, only: :create do
    post :token, on: :collection
  end
  resource :approve, only: %i[show create], controller: "approvals"
  resource :update, only: :show
end
```

Rules worth keeping on the Rails side:

- Keep only digests of the two codes. Filter `device_code`, `user_code` and
  `token` from the logs (`config.filter_parameters`).
- The two authorization requests carry no credential. Rate limit them.
- Approving is a signed-in person's own press on a page. No tool and no API
  call approves a request.
- A device token is a row (`Session` with a digest), so signing out a device is
  deleting the row.

## Updates

The app asks `GET /device/update` on a timer in the shell (never from the page)
and is told the newest build. The build itself never passes through Rails: it
sits in a bucket, and Rails signs a short-lived address to it.

```ruby
class DesktopRelease
  PREFIX = "releases/"

  Release = Data.define(:version, :key, :size, :sha256)

  # The newest build the bucket holds. The checksum was written at publish time
  # as object metadata, so answering reads no build.
  def self.newest
    Rails.cache.fetch("desktop_release/newest", expires_in: 1.minute) { listed.max_by { Gem::Version.new(_1.version) } }
  end

  def self.signed_url(release) = bucket.object(release.key).presigned_url(:get, expires_in: 15.minutes.to_i)
end

class Device::UpdatesController < Device::BaseController
  def show
    release = DesktopRelease.newest
    running = request.user_agent.to_s[%r{compound-stack-electron/(\d+\.\d+\.\d+)}, 1]
    newer = release && running && Gem::Version.new(release.version) > Gem::Version.new(running)
    return render(json: { update: nil }) unless newer

    render json: { update: {
      version: release.version, size: release.size, sha256: release.sha256, url: DesktopRelease.signed_url(release)
    } }
  end
end
```

Publishing is one task, run by a person from the machine that built the app:

```ruby
# lib/tasks/desktop.rake
namespace :desktop do
  desc "Publish a built disk image: DMG=dist/Compound-1.2.3.dmg VERSION=1.2.3 bin/rails desktop:publish"
  task publish: :environment do
    version = ENV.fetch("VERSION")
    newest = DesktopRelease.newest
    abort "#{version} is not higher than #{newest.version}" if newest && Gem::Version.new(version) <= Gem::Version.new(newest.version)

    file = Pathname(ENV.fetch("DMG"))
    DesktopRelease.bucket.object("#{DesktopRelease::PREFIX}Compound-#{version}.dmg").upload_file(
      file, metadata: { "sha256" => Digest::SHA256.file(file).hexdigest, "version" => version }
    )
  end
end
```

What the app does with the answer (`docs/modules/updates.md`): fetches the
image, holds it to the size and the SHA-256, copies the app out of it, checks
the copy (bundle id, a higher version, the signature, the same signing team as
the running app), and exchanges the two apps at the person's press on Restart
to update, or at quit.

Whoever can write under `releases/` can put code on every signed-in person's
machine. Treat a new way to write there as that decision.

## Files: presigned, never through Rails

Media and other large files go from the app to the bucket on an address Rails
signed for one `PUT` at one size. Rails makes a row only once the bucket holds
the object at that size.

```ruby
class Device::UploadsController < Device::BaseController
  def create
    key = "uploads/#{current_user.id}/#{SecureRandom.uuid}"
    size = Integer(params.require(:size))
    return head(:content_too_large) if size > Upload::MAX_BYTES

    render status: :created, json: {
      url: Upload.bucket.object(key).presigned_url(:put, expires_in: 300, content_length: size),
      ticket: Rails.application.message_verifier(:uploads).generate({ key:, size: }, expires_in: 1.hour)
    }
  end

  def finish
    claim = Rails.application.message_verifier(:uploads).verify(params.require(:ticket))
    return head(:unprocessable_entity) unless Upload.bucket.object(claim["key"]).content_length == claim["size"]

    render status: :created, json: { id: current_user.uploads.create!(key: claim["key"], bytes: claim["size"]).id }
  end
end
```

In the app the address and the ticket stay in the shell, as the token does. The
page hears a name, a size, a state and sentences. The template ships no upload
door: add one beside `documents` in `shell/assemble.mjs` when the app needs it.

## Deep links from a Rails page

A page of the Rails app opens the desktop app with a plain link:

```erb
<a href="compound://open/<%= project.id %>">Open in the app</a>
```

The address carries an id and nothing else: never a token, a signed address or
anything of an account. Any page or process can send one, so the app does only
what a press inside it could do, for a thing the signed-in account reaches
(`shell/app-link.mjs`, `docs/modules/deep_links.md`). Only a packaged build
declares the scheme.

To show the link only to people who have the app, have the app say so in a
header of its `/device` requests and keep that on the device's session. That is
true of the account, not of the computer the browser is on. Keep it to choosing
which button to draw.

## Local development

```sh
# In the Rails app
bin/dev                                   # http://localhost:3100

# In this repository
APP_SERVER=http://localhost:3100 npm run dev
```

Plain http is accepted only for this machine. A packaged build is set to its
server at package time (`APP_SERVER=https://app.example.com npm run package`),
and the address is written into the build.

## Tests on both sides

The Electron tests never ask a real server: `test/shell/account.test.mjs` and
the updater's tests hand in a `fetch` that answers the wire above. The Rails
side should have a controller test per row of the wire table. If either side
changes the wire, change this table, the Ruby and the app's tests together.
