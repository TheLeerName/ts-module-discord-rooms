import Module, {
	type RoomStateManager,
} from "../index.js";

import type {
	VoiceBasedChannel,
} from "discord.js";

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
		this.voiceChannel = (await this.manager.state.fetchChannelWithNotFoundHandling(this.voiceChannelID) ?? undefined) as typeof this.voiceChannel;
		if (this.voiceChannel == null) {
			this.manager.delete(this.voiceChannelID);
			Module.data.needsSave = true;
		}
	}

	async fromJSON(json: RoomStateSave) {
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