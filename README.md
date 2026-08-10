# Leer's TS module: Discord Rooms
Adds discord private rooms as voice channels, which can be created by joining specified voice channel. Also it can be customized by their owner (editing channel options). Before starting using this on discord server, please check `/rooms-create-category` command description

## Features
1. Adds slash commands:

|Name|Description|
|---|---|
|`/rooms-create-category`|Creates new category channel with voice channel in it, when joining to this channel, new room will be created|
|`/rooms-change-settings`|Changes some settings for discord server:<br>- Name template of each created room, placeholders are: %nickname%, %username%|
|`/rooms-change-owner`|Changes owner of room, where you right now (if you currently owner)|

2. If command `/rooms-change-settings` is banned on server by slash command allowing/banning system, module will stop functioning on this server

## How to install this module?
- Go to [parent repository](https://github.com/TheLeerName/ts-module-core) and read `README.md` file