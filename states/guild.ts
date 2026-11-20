import Module, {
	RoomStateManager,
	type GuildStateManager,
	type RoomStateManagerSave,
} from "../index.js";
import DiscordModule from "../../discord/index.js";

import {
	type Guild,
	type CategoryChannel,
	type VoiceBasedChannel,
	type Snowflake,
	type BaseFetchOptions,
	type UserResolvable,
	type FetchMemberOptions,
	type FetchMembersOptions,
	DiscordAPIError,
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
		return this.guild != null ? DiscordModule.getGuildNameAndID(this.guild) : this.guildID;
	}
	getCategoryChannelName() {
		return this.categoryChannel != null ? DiscordModule.getChannelNameAndID(this.categoryChannel) : this.categoryChannelID;
	}
	getCreateRoomChannelName() {
		return this.createRoomChannel != null ? DiscordModule.getChannelNameAndID(this.createRoomChannel) : this.createRoomChannelID;
	}
	/** **NOTE:** `isAvailable()` must return `true` for using this method */
	async fetchChannelWithNotFoundHandling(id: Snowflake, options?: BaseFetchOptions) {
		try {
			return this.guild!.channels.fetch(id, options);
		}
		catch(e) {
			if (e instanceof DiscordAPIError && e.code === 10003) {
				return null;
			}
			throw e;
		}
	}
	/** **NOTE:** `isAvailable()` must return `true` for using this method */
	async fetchGuildMemberWithNotFoundHandling(options: UserResolvable | FetchMemberOptions | (FetchMembersOptions & { user: UserResolvable })) {
		try {
			return this.guild!.members.fetch(options);
		}
		catch(e) {
			if (e instanceof DiscordAPIError && e.code === 10013) {
				return null;
			}
			throw e;
		}
	}

	/** **NOTE:** this method may set {@link Module.data.needsSave} to `true` */
	async setCategoryChannelFromFetch() {
		if (this.categoryChannelID != null) {
			this.categoryChannel = (await this.fetchChannelWithNotFoundHandling(this.categoryChannelID!) ?? undefined) as typeof this.categoryChannel;
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
	/** **NOTE:** this method may set {@link Module.data.needsSave} to `true` */
	async setCreateRoomChannelFromFetch() {
		if (this.createRoomChannelID != null) {
			this.createRoomChannel = (await this.fetchChannelWithNotFoundHandling(this.createRoomChannelID!) ?? undefined) as typeof this.createRoomChannel;
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