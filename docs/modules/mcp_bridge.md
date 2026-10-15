# Module: mcp_bridge

How an outside agent (Claude Code, Codex) would reach the open page's tools:
a local MCP server the shell starts, which lists and runs what
`window.pageAgent` lists and runs. This module is a doc. The template ships no
MCP server and no code for one.

## What this module is

The contract a bridge is built to.

- The seam is there. `window.pageAgent.tools()` answers each tool's name,
  description, `inputSchema` and `readOnly`. `window.pageAgent.run(name, args,
  by)` runs one through `runTool`, so the call is checked and written in the
  call log (see [agent_surface](agent_surface.md)). The bridge adds no tool of
  its own and no second way to run one.
- The shell starts the server, on this machine only: a local socket or the
  loopback address, never a port open to the network. It ends with the app.
- The server is the server side only. It forwards `tools/list` and
  `tools/call` to the page and returns the answer. It keeps no state of the
  document.
- A call names the agent. The bridge passes `by`, so the page asks the shell
  as that agent and nothing the agent asks counts as the person's press (see
  [bridge](bridge.md)). What is the person's own stays refused.
- Places stop at the shell. Where an agent names a file by its place, the
  server hands the place to the shell and sends the page a ticket in its
  stead: an id good once, for a short time, for the load of the page it was
  sent to. The page hands the ticket back and is answered what a pick in the
  dialog answers: an id and a name. No place is in an answer, a notice, the
  call log or a line the shell prints.
- A place an agent may name lies in a folder the person approved, by their own
  press, in the system's folder dialog. Approving one has no tool.
- Nothing of the account crosses. The token, the backend's address and the
  signed-in address are not in a tool's answer, and the server is given none
  of them. `get_state` already answers the account's state alone.
- Turning the bridge on is the person's setting, off until they turn it on.
- An agent connects with a secret the shell made for this launch, shown to the
  person where they turn the bridge on. It is not kept between launches.

## Files (the module boundary)

The seam that exists:

- `page/agent/tools.ts`: `pageAgent`, with `tools()` and `run()`.
- `page/main.tsx`: sets `window.pageAgent`.
- `page/agent/run.ts`: `runTool` and the call log.

No file of a bridge exists. Where they go:

- `bridge/` (you add): the MCP server, plain Node, with its own README and
  tests.
- `shell/agent-bridge.mjs` (you add): starts and ends the server, relays a
  call to the page over `shell:tell` and the answer back through a door. No
  Electron in it.
- `shell/file-tickets.mjs` (you add): makes and redeems tickets.
- `page/agent/bridge.ts` (you add): hears a relayed call and runs it with
  `pageAgent.run`.
- `shell/doors.json` and `shell/assemble.mjs`: the door the page answers
  through goes here.
- `shell/settings.mjs`: the setting that turns the bridge on goes here, with
  its row and its control.

## Adopt into an existing app

1. Adopt [agent_surface](agent_surface.md) first. Without `runTool` and the
   call log there is nothing safe to forward to.
2. Write the server against a fake page: `tools/list` from a fixed list,
   `tools/call` relayed and answered. Test it with Node alone.
3. Write `shell/agent-bridge.mjs` with the server's start handed in. Add the
   setting, off by default.
4. Add the page's side: hear a call, run it through `pageAgent.run` with the
   agent's name, answer through a door.
5. Add tickets before any tool takes a place. Until then, keep every tool as
   it is in the template: no tool takes a place, and a tool that needs a file
   shows the dialog.
6. Write the test that reads every tool's answer for a path, a token and the
   backend's address.

## Verify adoption

- `window.pageAgent.tools()` in the app's window lists the tools. That is
  true of the template today.
- The server's own tests pass with Node alone.
- A call made through the server is in the page's call log with the agent's
  name.
- A press that is the person's own is still refused when asked through the
  server.

## Gotcha: a dialog nobody sees

A tool that shows a system dialog waits for the person. An agent outside the
app does not see the window. Bring the window forward for the dialog
(`dialogPlace` does, see [shell](shell.md)) and give the call a way to be let
go, or the agent waits on a dialog behind another app.
