import Module from "../../index.js";
import type { RoomStateManager } from "../room.js";

import type { VoiceBasedChannel } from "discord.js";

export class RoomStateSave {
	voiceChannelID: string;
	ownerID: string;
}

export class RoomState {
	voiceChannel?: VoiceBasedChannel;
	voiceChannelID: string;

	ownerID: string;

	readonly manager: RoomStateManager;
	constructor(manager: RoomStateManager) {
		this.manager = manager;
	}

	isAvailable(): this is RoomStateAvailable {
		return this.manager.state.isAvailable();
	}
	getVoiceChannelName() {
		return this.voiceChannel != null ? Module.discord.getChannelNameAndID(this.voiceChannel) : this.voiceChannelID;
	}
	getOwnerName() {
		return this.manager.state.guild!.members.cache.get(this.ownerID) ?? this.ownerID;
	}

	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	async changeOwner(newOwnerID: string) {
		if (this.voiceChannel!.permissionOverwrites.cache.has(this.ownerID))
			await this.voiceChannel!.permissionOverwrites.delete(this.ownerID);
		await this.voiceChannel!.permissionOverwrites.create(newOwnerID, Module.permissionsOwner);
		this.ownerID = newOwnerID;
		Module.data.needsSave = true;
		return this;
	}
	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	async setVoiceChannelFromFetch() {
		this.voiceChannel = (await Module.discord.fetchChannelWithNotFoundHandling(this.manager.state.guild!, this.voiceChannelID) ?? undefined) as typeof this.voiceChannel;
		if (this.voiceChannel == null)
			this.manager.unset(this);
	}

	fromJSON(json: RoomStateSave) {
		this.voiceChannelID = json.voiceChannelID;
		this.ownerID = json.ownerID;
	}
	toJSON(): RoomStateSave {
		return {
			voiceChannelID: this.voiceChannel?.id ?? this.voiceChannelID,
			ownerID: this.ownerID,
		};
	}
}

export interface RoomStateAvailable extends RoomState {
	voiceChannel: VoiceBasedChannel;
}