import Module from "../index.js";
import { type GuildState, type GuildStateAvailable } from "./states/guild.js";
import { RoomState, type RoomStateSave, type RoomStateAvailable } from "./states/room.js";

import {
	EmbedBuilder,
	type GuildMember,
	ChannelType,
	type VoiceState,
} from "discord.js";

export type RoomStateManagerSave = RoomStateSave[] | undefined;
/** key is voice channel id */
export class RoomStateManager extends Map<string, RoomState> {
	readonly state: GuildState;
	constructor(state: GuildState) {
		super();
		this.state = state;
	}

	override get<_RoomState extends RoomState = RoomState>(key: string) {
		return super.get(key) as _RoomState | undefined;
	}
	override values<_RoomState extends RoomState = RoomState>() {
		return super.values() as MapIterator<_RoomState>;
	}

	/** NOTE: this method will set {@link Module.data.needsSave} to `true` */
	async createByMember(owner: GuildMember) {
		const voiceChannel = await this.state.guild!.channels.create({
			type: ChannelType.GuildVoice,
			name: this.state.getRoomVoiceChannelName(owner.nickname ?? owner.user.displayName, owner.user.username),
			parent: this.state.categoryChannel,
		});
		await voiceChannel.permissionOverwrites.create(owner.id, Module.permissionsOwner);
		const room = new RoomState(this);
		room.voiceChannel = voiceChannel;
		room.voiceChannelID = voiceChannel.id;
		room.ownerID = owner.id;
		this.set(room.voiceChannel.id, room);
		Module.data.needsSave = true;
		Module.log.info("Created room for owner", {args: {
			guild: Module.discord.getGuildNameAndID(this.state.guild!),
			user: Module.discord.getUserNameAndID(owner.user),
		}});
		return room;
	}
	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	unset(room: RoomState, reason?: string) {
		Module.log.warn(`Guild was disabled`, {causedBy: reason ?? `"rooms.get('${room.voiceChannelID}')" was unset`, args: {
			guild: this.state.getGuildName(),
			roomOwner: room.getOwnerName(),
			roomVoiceChannelName: room.getVoiceChannelName(),
		}});
		this.delete(room.voiceChannelID);
		Module.data.needsSave = true;
	}

	fromJSON(array: RoomStateManagerSave) {
		if (array == null) return;

		for (const roomSave of array) {
			const room = new RoomState(this);
			room.fromJSON(roomSave);
			this.set(roomSave.voiceChannelID, room);
		}
	}
	toJSON(): RoomStateManagerSave {
		return this.size > 0 ? Array.from(this.values()).map(v => v.toJSON()) : undefined;
	}
	protected checkRoomState(room: RoomStateAvailable, member?: GuildMember) {
		if (room.voiceChannel.members.size <= 0) {
			const memberNameAndID = member != null ? Module.discord.getGuildMemberNameAndID(member) : undefined;
			this.unset(room, memberNameAndID != null ? `Last member ${memberNameAndID} leaved room` : `No members left`);
			room.voiceChannel.delete(memberNameAndID != null ? `Последний участник ${memberNameAndID} покинул комнату` : `Участников канала не осталось`);
			Module.data.save(true);
		}
		else if (!room.voiceChannel.members.has(room.ownerID)) {
			const oldOwnerID = room.ownerID;
			const newOwnerID = room.voiceChannel.members.random()!.id;
			room.ownerID = newOwnerID;
			Promise.all([
				room.changeOwner(newOwnerID),
				room.voiceChannel.send({embeds: [new EmbedBuilder().setColor("Yellow").setDescription(`Права владельца канала были переданы <@${newOwnerID}>, так как предыдущий владелец <@${oldOwnerID}> покинул(а) канал`)]}),
			]).then(() => Module.data.save(true));
		}
	}

	async onGuildAvailable(state: GuildStateAvailable) {
		for (const room of this.values<RoomStateAvailable>()) {
			await room.setVoiceChannelFromFetch();
			this.checkRoomState(room);
		}
	}
	onVoiceStateUpdate(state: VoiceState & { channelId: string; member: GuildMember; }, isJoining: boolean) {
		if (isJoining) {
			const room = this.get<RoomStateAvailable>(state.channelId);
			if (room == null) return;

			// saving voiceMembers
			Module.data.save(true);
		}
		// left voice
		else {
			const room = this.get<RoomStateAvailable>(state.channelId);
			if (room == null) return;

			this.checkRoomState(room, state.member);
		}
	}
}

export {
	RoomState,
	type RoomStateAvailable,
	type RoomStateSave,
} from "./states/room.js";