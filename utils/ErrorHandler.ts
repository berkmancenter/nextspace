import { NextRouter } from "next/router";

/**
 * Checks if the router query parameters are valid for a conversation and returns an error message if they are not.
 * @param router - The Next.js router object.
 */
export const QueryParamsError = (router: NextRouter) => {
  if (!router.query.conversationId || !router.query.passcode) {
    let messageSuffix = "a Conversation ID";
    if (!router.query.conversationId && !router.query.passcode)
      messageSuffix = "both a Conversation ID and Passcode";
    else if (router.query.conversationId && !router.query.passcode)
      messageSuffix = "a Passcode";

    return `Please provide ${messageSuffix}.`;
  }
  return "Something went wrong";
};
