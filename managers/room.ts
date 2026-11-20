import Module, {
	RoomState,
	type RoomStateSave,
	type RoomStateAvailable,
	type GuildState,
	type GuildStateAvailable,
} from "../index.js";
import DiscordModule from "../../discord/index.js";

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
			guild: DiscordModule.getGuildNameAndID(this.state.guild!),
			user: DiscordModule.getUserNameAndID(owner.user),
		}});
		return room;
	}

	async onGuildAvailable(state: GuildStateAvailable) {
		for (const room of this.values<RoomStateAvailable>()) {
			await room.setVoiceChannelFromFetch();
			this.checkRoomState(room);
		}
	}
	onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
		if (newState.channel != null && newState.channel.id === this.state.createRoomChannelID) {
			this.createByMember(newState.member!).then(room => {
				newState.setChannel(room.voiceChannel!, `Создание комнаты`);
				Module.data.save(true);
			});
			return;
		}

		// joined to voice
		if (oldState.channel == null && newState.channel != null) {
			const room = this.get<RoomStateAvailable>(newState.channel.id);
			if (room == null) return;

			// saving voiceMembers
			Module.data.save(true);
		}
		// left voice
		else if (oldState.channel != null && newState.channel == null) {
			const room = this.get<RoomStateAvailable>(oldState.channel.id);
			if (room == null) return;

			this.checkRoomState(room, oldState.member!);
		}
	}

	protected checkRoomState(room: RoomStateAvailable, member?: GuildMember) {
		if (room.voiceChannel.members.size <= 0) {
			this.delete(room.voiceChannelID);
			room.voiceChannel.delete(member != null ? `Последний участник ${DiscordModule.getGuildMemberNameAndID(member)} покинул комнату` : `Участников канала не осталось`);
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
}