# Leer's TS module: Discord Rooms
Adds discord private rooms as voice channels, which can be created by joining specified voice channel. Also it can be customized by their owner (editing channel options). Before starting using this on discord server, please check `/rooms-create-category` command description

## Features
1. Adds slash commands:

|Name|Type|Description|
|---|---|---|
|`/rooms-create-category`|Guild-only|Creates new category channel with voice channel in it, when joining to this channel, new room will be created|
|`/rooms-change-guild-settings`|Guild-only|Changes some settings for discord server:<br>- Name template of each created room, placeholders are: %nickname%, %username%|
|`/rooms-get-guild-settings`|Guild-only|Sends some settings for discord server
|`/rooms-change-owner`|Guild-only|Changes owner of room, where you right now (if you currently owner)|

1. If command `/rooms-change-guild-settings` is banned on server by slash command allowing/banning system, module will stop functioning on this server

## How to install this module?
- Go to [parent repository](https://github.com/TheLeerName/ts-module-core) and read `README.md` file

## TODO
- room permissions will be saved for owner on leave channel and setted to any new room of this owner
- setup friends for user: if user leaves room their owner rights goes to random friend
- buttons: lock channel for everyone, change owner and smth else