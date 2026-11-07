import { BaseData } from "../../data.js";
import DiscordModule from "../discord/index.js";
import Module from "./index.js";

import * as Discord from "discord.js";

// 1. when owner leaving channel, if there are members then make oldest (in room) user as owner
export interface Room {
	voiceChannel: Discord.VoiceChannel;
	owner: Discord.GuildMember;
	voiceMembers: Discord.GuildMember[];
}

export class Guild {
	enabled: boolean;
	guild?: Discord.Guild;
	guildID?: string;
	categoryChannel?: Discord.CategoryChannel;
	categoryChannelID?: string;
	createRoomChannel?: Discord.VoiceChannel;
	createRoomChannelID?: string;
	roomVoiceChannelNameTemplate: string = `Хата %nickname%`;
	roomsByVoiceChannelID: Discord.Collection<string, Room>;

	constructor(enabled: boolean, guild?: Discord.Guild, guildID?: string, categoryChannel?: Discord.CategoryChannel, categoryChannelID?: string, createRoomChannel?: Discord.VoiceChannel, createRoomChannelID?: string, roomVoiceChannelNameTemplate?: string) {
		this.enabled = enabled;
		this.guild = guild;
		this.guildID = guildID;
		this.categoryChannel = categoryChannel;
		this.categoryChannelID = categoryChannelID;
		this.createRoomChannel = createRoomChannel;
		this.createRoomChannelID = createRoomChannelID;
		if (roomVoiceChannelNameTemplate) this.roomVoiceChannelNameTemplate = roomVoiceChannelNameTemplate;
		this.roomsByVoiceChannelID = new Discord.Collection();
	}

	isEnabled(): this is Guild.Enabled {
		return this.enabled;
	}

	disable(): Guild {
		if (this.guild)
			this.guildID = this.guild.id;
		this.guild = undefined;

		if (this.categoryChannel)
			this.categoryChannelID = this.categoryChannel.id;
		this.categoryChannel = undefined;

		if (this.createRoomChannel)
			this.createRoomChannelID = this.createRoomChannel.id;
		this.createRoomChannel = undefined;

		this.enabled = false;
		this.roomsByVoiceChannelID.clear();

		return this;
	}
}
export namespace Guild {
	export interface Enabled extends Guild {
		enabled: true;
		guild: Discord.Guild;
		guildID: undefined;
		categoryChannel: Discord.CategoryChannel;
		categoryChannelID: undefined;
		createRoomChannel: Discord.VoiceChannel;
		createRoomChannelID: undefined;
	}
}

export default class ModuleData extends BaseData {
	guilds: Map<string, Guild> = new Map();

	async initialize() {
		const json = this.getSavedFields();
		let needsSave = true;

		// registering save fields
		needsSave = !(await this.registerFieldAnyAsync(json, "guilds", async(saved) => {
			if (!Array.isArray(saved)) return;

			for (const savedEntry of saved) {
				if (typeof savedEntry !== "object") continue;

				const guildData: Guild = new Guild(false, undefined,
					typeof savedEntry.guildID === "string" ? savedEntry.guildID : undefined,
					undefined,
					typeof savedEntry.categoryChannelID === "string" ? savedEntry.categoryChannelID : undefined,
					undefined,
					typeof savedEntry.createRoomChannelID === "string" ? savedEntry.createRoomChannelID : undefined,
					typeof savedEntry.roomVoiceChannelNameTemplate === "string" ? savedEntry.roomVoiceChannelNameTemplate : undefined
				);
				if (!guildData.guildID) continue;

				try {
					guildData.guild = await DiscordModule.client.guilds.fetch(guildData.guildID);
				}
				catch(error) {
					Module.log.error("Getting guilds...guild failed!", {error, args: {guildID: guildData.guildID}});
					continue;
				}

				if (guildData.categoryChannelID) {
					try {
						const c = await DiscordModule.client.channels.fetch(guildData.categoryChannelID);
						if (!c)
							throw new Error("Not found");
						if (c.type !== Discord.ChannelType.GuildCategory)
							throw new Error("Wrong type");
						guildData.categoryChannel = c;
						guildData.categoryChannelID = undefined;
						guildData.guild = guildData.categoryChannel.guild;
					}
					catch(error) {
						Module.log.error("Getting guilds...categoryChannel failed!", {error, args: {guild: `${guildData.guild.name} (${guildData.guild.id})`, categoryChannelID: guildData.categoryChannelID}});
					}
				}

				if (guildData.createRoomChannelID) {
					try {
						const c = await DiscordModule.client.channels.fetch(guildData.createRoomChannelID);
						if (!c)
							throw new Error("Not found");
						if (c.type !== Discord.ChannelType.GuildVoice)
							throw new Error("Wrong type");
						guildData.createRoomChannel = c;
						guildData.createRoomChannelID = undefined;
						guildData.guild = guildData.createRoomChannel.guild;
					}
					catch(error) {
						Module.log.error("Getting guilds...createRoomChannel failed!", {error, args: {guild: `${guildData.guild.name} (${guildData.guild.id})`, createRoomChannelID: guildData.createRoomChannelID}});
					}
				}

				if (Array.isArray(savedEntry.rooms)) for (const savedRoom of savedEntry.rooms) {
					if (!this.isRecord(savedRoom)) continue;

					let voiceChannel: Discord.VoiceChannel | null = null;
					if (typeof savedRoom.voiceChannelID === "string") {
						try {
							const c = await DiscordModule.client.channels.fetch(savedRoom.voiceChannelID);
							if (!c)
								throw new Error("Not found");
							if (c.type !== Discord.ChannelType.GuildVoice)
								throw new Error("Wrong type");
							voiceChannel = c;
							guildData.guild = c.guild;
						}
						catch(error) {
							Module.log.error("Getting guilds...rooms...voiceChannel failed!", {error, args: {guild: `${guildData.guild.name} (${guildData.guild.id})`, voiceChannelID: savedRoom.voiceChannelID}});
							continue;
						}
					}
					else
						continue;

					let owner: Discord.GuildMember | null = null;
					if (typeof savedRoom.ownerID === "string") {
						try {
							owner = await guildData.guild.members.fetch(savedRoom.ownerID);
						}
						catch(error) {
							Module.log.error("Getting guilds...rooms...owner failed!", {error, args: {guild: `${guildData.guild.name} (${guildData.guild.id})`, ownerID: savedRoom.ownerID}});
							continue;
						}
					}
					else
						continue;

					const voiceMembers: Discord.GuildMember[] = [];
					if (Array.isArray(savedRoom.voiceMemberIDs)) for (const voiceMemberID of savedRoom.voiceMemberIDs) {
						if (typeof voiceMemberID !== "string") continue;

						try {
							const voiceMember = await guildData.guild.members.fetch(voiceMemberID);
							voiceMembers.push(voiceMember);
						}
						catch(error) {
							Module.log.error("Getting guilds...rooms...voiceMember failed!", {error, args: {guild: `${guildData.guild.name} (${guildData.guild.id})`, voiceChannel: `${voiceChannel.name} (${voiceChannel.id})`, owner: `${owner.user.username} (${owner.user.id})`, voiceMemberID}});
							continue;
						}
					}

					const roomData: Room = {voiceChannel, owner, voiceMembers};
					guildData.roomsByVoiceChannelID.set(voiceChannel.id, roomData);
				}

				if (guildData.guild) {
					if (guildData.categoryChannel != null && guildData.createRoomChannel != null)
						guildData.enabled = true;
					this.guilds.set(guildData.guild.id, guildData);
				}
			}
			await this.save();
		}, async() => {
			const save: {guildID: string | null, categoryChannelID: string | null, createRoomChannelID: string | null, roomVoiceChannelNameTemplate: string, rooms: {voiceChannelID: string, ownerID: string, voiceMemberIDs: string[]}[]}[] = [];
			for (const guildData of this.guilds.values()) {
				if (guildData.isEnabled())
					save.push({guildID: guildData.guild.id, categoryChannelID: guildData.categoryChannel.id, createRoomChannelID: guildData.createRoomChannel.id, roomVoiceChannelNameTemplate: guildData.roomVoiceChannelNameTemplate, rooms: guildData.roomsByVoiceChannelID.map(c => {return {voiceChannelID: c.voiceChannel.id, ownerID: c.owner.id, voiceMemberIDs: c.voiceMembers.map(m => m.id)}})});
				else
					save.push({guildID: guildData.guildID ?? null, categoryChannelID: guildData.categoryChannelID ?? null, createRoomChannelID: guildData.createRoomChannelID ?? null, roomVoiceChannelNameTemplate: guildData.roomVoiceChannelNameTemplate, rooms: []});
			}
			return save;
		}));

		if (needsSave)
			await this.save();
		return this;
	}

	getGuild(guildID: string) {
		let guildData = this.guilds.get(guildID);
		if (!guildData) {
			guildData = new Guild(false);
			this.guilds.set(guildID, guildData);
			this.save();

			DiscordModule.client.guilds.fetch(guildID).then(guild => Module.log.info("Initialized guild data", {args: {guild: `${guild.name} (${guild.id})`}}));
		}
		return guildData;
	}
}