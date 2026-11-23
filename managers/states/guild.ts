import Module from "../../index.js";
import type { GuildStateManager } from "../guild.js";
import { RoomStateManager, type RoomStateManagerSave } from "../room.js";

import {
	type Guild,
	type CategoryChannel,
	type VoiceBasedChannel,
} from "discord.js";

export interface GuildStateSave {
	disabled?: true;
	guildID: string;
	categoryChannelID?: string;
	createRoomChannelID?: string;
	roomVoiceChannelNameTemplate?: string;
	rooms?: RoomStateManagerSave;
}

export class GuildState {
	enabled: boolean = false;

	guild?: Guild;
	guildID: string;

	categoryChannel?: CategoryChannel;
	categoryChannelID?: string;

	createRoomChannel?: VoiceBasedChannel;
	createRoomChannelID?: string;

	roomVoiceChannelNameTemplate?: string;
	static ROOM_VOICE_CHANNEL_NAME_TEMPLATE = "Хата %nickname%";

	/** key is voice channel id */
	readonly rooms: RoomStateManager = new RoomStateManager(this);

	readonly manager: GuildStateManager;

	constructor(manager: GuildStateManager) {
		this.manager = manager;
	}

	getRoomVoiceChannelName(nickname: string, username: string): string {
		return (this.roomVoiceChannelNameTemplate ?? GuildState.ROOM_VOICE_CHANNEL_NAME_TEMPLATE)
			.replaceAll("%nickname%", nickname)
			.replaceAll("%username%", username);
	}
	isAvailable(): this is GuildStateAvailable {
		return this.enabled && this.guild != null && this.guild.available;
	}
	getGuildName() {
		return this.guild != null ? Module.discord.getGuildNameAndID(this.guild) : this.guildID;
	}
	getCategoryChannelName() {
		return this.categoryChannel != null ? Module.discord.getChannelNameAndID(this.categoryChannel) : this.categoryChannelID;
	}
	getCreateRoomChannelName() {
		return this.createRoomChannel != null ? Module.discord.getChannelNameAndID(this.createRoomChannel) : this.createRoomChannelID;
	}

	/** **NOTE:** this method may set {@link Module.data.needsSave} to `true` */
	async setCategoryChannelFromFetch() {
		if (this.categoryChannelID != null) {
			this.categoryChannel = (await Module.discord.fetchChannelWithNotFoundHandling(this.guild!, this.categoryChannelID!) ?? undefined) as typeof this.categoryChannel;
			if (this.categoryChannel == null) {
				Module.log.warn(`Guild was disabled`, {causedBy: `"categoryChannel" was unset`, args: {
					guild: this.getGuildName(),
					categoryChannel: this.getCategoryChannelName(),
				}});
				this.enabled = false;
				delete this.categoryChannel;
				delete this.categoryChannelID;
				Module.data.needsSave = true;
			}
		}
	}
	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	unsetCategoryChannel(reason?: string) {
		Module.log.warn(`Guild was disabled`, {causedBy: reason ?? `"categoryChannel" was unset`, args: {
			guild: this.getGuildName(),
			categoryChannel: this.getCategoryChannelName(),
		}});
		this.enabled = false;
		delete this.categoryChannel;
		delete this.categoryChannelID;
		Module.data.needsSave = true;
	}
	/** **NOTE:** this method may set {@link Module.data.needsSave} to `true` */
	async setCreateRoomChannelFromFetch() {
		if (this.createRoomChannelID != null) {
			this.createRoomChannel = (await Module.discord.fetchChannelWithNotFoundHandling(this.guild!, this.createRoomChannelID!) ?? undefined) as typeof this.createRoomChannel;
			if (this.createRoomChannel == null) {
				Module.log.warn(`Guild was disabled`, {causedBy: `"createRoomChannel" was unset`, args: {
					guild: this.getGuildName(),
					createRoomChannel: this.getCreateRoomChannelName(),
				}});
				this.enabled = false;
				delete this.createRoomChannel;
				delete this.createRoomChannelID;
				Module.data.needsSave = true;
			}
		}
	}
	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	unsetCreateRoomChannel(reason?: string) {
		Module.log.warn(`Guild was disabled`, {causedBy: reason ?? `"categoryChannel" was unset`, args: {
			guild: this.getGuildName(),
			createRoomChannel: this.getCreateRoomChannelName(),
		}});
		this.enabled = false;
		delete this.createRoomChannel;
		delete this.createRoomChannelID;
		Module.data.needsSave = true;
	}

	fromJSON(json: GuildStateSave) {
		this.enabled = !json.disabled;
		this.guildID = json.guildID;
		this.categoryChannelID = json.categoryChannelID;
		this.createRoomChannelID = json.createRoomChannelID;
		this.roomVoiceChannelNameTemplate = json.roomVoiceChannelNameTemplate;
		this.rooms.fromJSON(json.rooms);
	}
	toJSON(): GuildStateSave {
		return {
			disabled: this.enabled == true ? undefined : true,
			guildID: this.guild?.id ?? this.guildID,
			categoryChannelID: this.categoryChannel?.id ?? this.categoryChannelID,
			createRoomChannelID: this.createRoomChannel?.id ?? this.createRoomChannelID,
			roomVoiceChannelNameTemplate: this.roomVoiceChannelNameTemplate,
			rooms: this.rooms.toJSON(),
		};
	}
}

export interface GuildStateAvailable extends GuildState {
	guild: Guild;

	categoryChannel: CategoryChannel;
	categoryChannelID: string;

	createRoomChannel: VoiceBasedChannel;
	createRoomChannelID: string;
}