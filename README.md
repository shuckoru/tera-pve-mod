```markdown
# PVE Module

This module is designed to provide various functionalities for Player vs Environment (PVE) in the game TERA.

## Features

- DPS Meter: Measures and displays the Damage Per Second (DPS) output of the player and the party.
- Fight Timer: Tracks the duration of the fight.
- Burn Reminder: Sends a reminder for the 'Burn' phase of the fight.
- Damage Value Tester: Tests and displays the damage value of different skills.
- Abnormalities Debugger: Debugs and tracks different abnormalities in the game.
- Fight Details Auto Paste: Automatically pastes the details of the fight in the party chat.
- First Tick Skills: Tracks the first tick of damage from specific skills.

## Configuration

The module can be configured by modifying the following files:

- `blacklistedAbnormalities.json`: Contains a list of abnormalities that are ignored by the module.
- `trackedAbnormalities.json`: Contains a list of abnormalities that are tracked by the module.

## Usage

The module provides several commands that can be used in the game:

- 'dps': Toggles the DPS meter.
- 'timer': Toggles the fight timer.
- 'burn': Toggles the burn reminder.
- 'reset': Resets the current state.
- 'paste': Pastes the fight details in the party chat.
- 'autopaste': Toggles automatic pasting of fight details in the party chat.
- 'dvt': Toggles the damage value tester.
- 'dvtv': Toggles verbose mode for the damage value tester.
- 'ftskill <skillId>': Adds a skill to the first tick skills list.
- 'ftskillrm <skillId>': Removes a skill from the first tick skills list.

## Installation

- unzip folder or clone it
- put the folder in the /mods folder of tera toolbox
- launch the game

If you feel like this mod has been helpful to you feel free to buy me a coffe: https://ko-fi.com/shuckol

Note: `/node_modules` sadly needs to be pushed in the repo because tera-toolbox doesn't support installing dependencies automatically..
```
