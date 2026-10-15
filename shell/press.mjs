// Whose press it was. Some things are the person's alone: signing in, restarting
// to update, discarding a kept document. The page cannot be trusted to say a
// press was behind a call, since an agent's tool runs in the same page. So the
// preload reads the browser's own word (`navigator.userActivation.isActive`) in
// its isolated world, where no page script can set it, and sends it with every
// call as `who.gesture`. A call an agent made names the agent as `who.askedBy`.

/** The sentence a door refuses with when a press was needed and none was behind the call. */
export const NOT_THE_PRESS = 'This is done by pressing its button in the window.'

/** Whether a call was the person's own press: the browser says so, and no agent is named. */
export const ownPress = (who) => who?.gesture === true && !who?.askedBy

/** Whether the person has to be asked first, because the call was not their own press. */
export const mustAsk = (who) => !ownPress(who)
