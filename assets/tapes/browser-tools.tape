Require opencode

Output assets/browser-tools.gif

Set Shell "bash"
Set FontSize 16
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set Padding 10

# Boot opencode
Hide
Type "opencode"
Enter
Sleep 6s
Show

# Prompt that uses browser tools
Type "Open a browser and navigate to https://example.com. Take a screenshot and describe what you see."
Sleep 500ms
Enter

# Wait for browser interaction
Sleep 25s
