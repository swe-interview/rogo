/**
 * The role on a conversation message.
 *
 * Messages can only be either user or assistant.
 */
export class Role {
  /** A message from the analyst, including tool results sent back to the model. */
  static readonly user = "user" as const;

  /** A message from the model. */
  static readonly assistant = "assistant" as const;

  private constructor() {}
}
