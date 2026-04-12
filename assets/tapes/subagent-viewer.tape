Require opencode

Output assets/subagent-viewer.gif

Set Shell "bash"
Set FontSize 16
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set Padding 10

# Boot opencode with minimal config — no MCP servers
Hide
Type "source assets/tapes/demo-env.sh"
Enter
Sleep 500ms
Type "opencode"
Enter
Sleep 6s
Show

# Prompt that spawns multiple subagent tasks
Type "Spawn 3 tasks using the task tool, each sleeping for 3, 5 and 7 seconds, respectively"
Sleep 500ms
Enter

# Wait for tasks to spawn, panes to open, and complete
Sleep 25s
