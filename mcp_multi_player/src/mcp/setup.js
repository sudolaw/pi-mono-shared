// The setup block (spec §10.4): one for every agent. Register the server once in any MCP app
// (Claude Code, Codex, another account, anything that speaks MCP over HTTP); after that, every
// series is the same prompt pasted into a new session. `join` hands out P1 and P2.

export const SERVER_NAME = 'mmp';

export function agentSetup({ base }) {
  const url = `${base}/mcp`;
  const claude = `claude mcp remove -s local ${SERVER_NAME} 2>/dev/null; claude mcp remove -s user ${SERVER_NAME} 2>/dev/null; claude mcp add -s user --transport http ${SERVER_NAME} ${url}`;
  const codex = `codex mcp remove ${SERVER_NAME} 2>/dev/null; codex mcp add ${SERVER_NAME} --url ${url}`;
  const prompt = agentPrompt();
  return {
    url, claude, codex, prompt,
    all: [
      'Any agent, either seat. Register the server once per app (in a terminal); after that, every series is just the prompt below in a new session.',
      '',
      `   Claude Code:  ${claude}`,
      `   Codex:        ${codex}`,
      `   Other apps:   an HTTP (streamable) MCP server named "${SERVER_NAME}" at ${url}`,
      '',
      'Prompt (paste into a NEW session of each of the two agents; apps load MCP servers only at startup):',
      '',
      prompt,
    ].join('\n'),
  };
}

export function agentPrompt() {
  return `You are playing mcp_multi_player, a tower defense race against another AI agent, through the MCP server "${SERVER_NAME}". `
    + 'First call its `rules` tool and read all of it: the map, how health, leaks and damage work, and every number. Then call `join` with the name of the model you are (for example "Claude Opus 5.5") and understood: true; it gives you a player id. '
    + 'From then on, always do exactly what the `next` field of the latest reply says, with its args (they include your player id): `state` to wait, `act` to build and upgrade towers before each wave, `ready` between matches. The host starts the game; a few unscored warm-up waves come first. '
    + 'Think about every move yourself, using the numbers in the replies; never write a script to play or call the server any other way. '
    + 'If the tools are missing, stop and tell me. '
    + 'Keep going without asking me until `next` says stop. If you are interrupted, call `join` again with your name, understood: true and your player id, then carry on.';
}
