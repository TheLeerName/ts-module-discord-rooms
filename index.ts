import Core, { type BaseData, type IModule } from "../../index.js";
import DiscordModule from "../discord/index.js";
import ModuleData, { Guild, type Room } from "./data.js";
import SlashCommandCreateCategory from "./slash-commands/create-category.js";
import SlashCommandChangeSettings, { slashCommandChangeSettingsName } from "./slash-commands/change-settings.js";
import SlashCommandChangeOwner from "./slash-commands/change-owner.js";

import * as Discord from "discord.js";

export class DiscordRoomsModule {
	readonly name = "discord-rooms" as const;
	readonly data: ModuleData;
	readonly log = Core.log.makeFunctions(this.name);

	readonly permissionsOwner: Discord.PermissionOverwriteOptions = {ViewChannel: true, ManageChannels: true, ManageRoles: true, ManageMessages: true, PinMessages: true, BypassSlowmode: true, ManageThreads: true, SendTTSMessages: true};

	constructor() {
		this.data = new ModuleData(this);

		DiscordModule
			.once("addAuthorizationFields", a => a
				.addPermissions(Discord.PermissionFlagsBits.ManageChannels, Discord.PermissionFlagsBits.ManageGuild, Discord.PermissionFlagsBits.ModerateMembers, Discord.PermissionFlagsBits.MoveMembers, Discord.PermissionFlagsBits.ViewChannel)
				.addScopes(Discord.OAuth2Scopes.Guilds)
				.addPartials(Discord.Partials.Channel, Discord.Partials.GuildMember, Discord.Partials.User)
				.addIntents(Discord.GatewayIntentBits.GuildMembers, Discord.GatewayIntentBits.GuildModeration, Discord.GatewayIntentBits.GuildVoiceStates, Discord.GatewayIntentBits.Guilds))
			.once("afterClientCreation", () => this.afterDiscordClientCreation());
	}

	protected afterDiscordClientCreation() {
		DiscordModule.slashCommands.push(SlashCommandCreateCategory(), SlashCommandChangeSettings(), SlashCommandChangeOwner());

		DiscordModule.client
			.once("shard0Ready", async() => {
				await this.data.initialize();
				this.onShard0Ready();
				DiscordModule.client.on("shard0Ready", () => this.onShard0Ready());
			}).on("channelUpdate", (oldChannel, newChannel) => this.onChannelUpdate(oldChannel, newChannel))
			.on("channelDelete", channel => this.onChannelDelete(channel))
			.on("voiceStateUpdate", (oldState, newState) => this.onVoiceStateUpdate(oldState, newState));
	}

	protected async onShard0Ready() {
		for (let guildData of this.data.guilds.values()) {
			if (!guildData.isEnabled()) continue;

			try {
				guildData.guild = await DiscordModule.client.guilds.fetch(guildData.guild.id);
			}
			catch(error) {
				this.data.guilds.delete(guildData.guild.id);
				this.log.error("Guild data was deleted", {error, args: {guild: `${guildData.guild.name} (${guildData.guild.id})`}});
				continue;
			}

			try {
				const c = (await guildData.guild.channels.fetch(guildData.categoryChannel.id) as Discord.CategoryChannel | null);
				if (!c)
					throw new Error("Not found");
				guildData.categoryChannel = c;
			}
			catch(error) {
				guildData.disable().categoryChannelID = undefined;
				this.log.error("Guild data was disabled", {error, args: {guild: `${guildData.guild.name} (${guildData.guild.id})`}});
				continue;
			}

			try {
				const c = (await guildData.guild.channels.fetch(guildData.createRoomChannel.id) as Discord.VoiceChannel | null);
				if (!c)
					throw new Error("Not found");
				guildData.createRoomChannel = c;
			}
			catch(error) {
				guildData.disable().createRoomChannelID = undefined;
				this.log.error("Guild data was disabled", {error, args: {guild: `${guildData.guild.name} (${guildData.guild.id})`}});
				continue;
			}

			for (const roomData of guildData.roomsByVoiceChannelID.values()) {
				if (roomData.voiceChannel.members.size > 0) {
					const previousMembers = roomData.voiceMembers.sort();
					const memberIDs = Array.from(roomData.voiceChannel.members.keys());

					// quit members
					for (const newOwner of previousMembers.filter(m => !memberIDs.includes(m.id))) {
						if (newOwner.id === roomData.owner.id) {
							const oldOwner = roomData.owner;
							await this.changeRoomOwner(roomData, newOwner);
							await roomData.voiceChannel.send({embeds: [new Discord.EmbedBuilder().setColor("Yellow").setDescription(`Права владельца канала были переданы <@${newOwner.id}>, так как предыдущий владелец <@${oldOwner.id}> покинул(а) канал`)]});
							break;
						}
					}
				}
				else {
					guildData.roomsByVoiceChannelID.delete(roomData.voiceChannel.id);
					await roomData.voiceChannel.delete(`Участников канала не осталось`);
				}
				roomData.voiceMembers = Array.from(roomData.voiceChannel.members.values()).sort();
			}
		}
		await this.data.save();
	}

	protected onChannelUpdate(oldChannel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel, newChannel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel) {
		if (newChannel.isDMBased()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeSettingsName, newChannel.guild.id)) return;

		const guildData = this.data.getGuild(newChannel.guild.id);
		if (!guildData.isEnabled()) return;

		guildData.guild = newChannel.guild;
		if (guildData.categoryChannel.id === newChannel.id)
			(guildData.categoryChannel as any) = newChannel;
		else if (guildData.createRoomChannel.id === newChannel.id)
			(guildData.createRoomChannel as any) = newChannel;
		for (const roomData of guildData.roomsByVoiceChannelID.values()) {
			if (roomData.voiceChannel.id === newChannel.id)
				(roomData.voiceChannel as any) = newChannel;
		}
	}

	protected async onChannelDelete(channel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel) {
		if (channel.isDMBased()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeSettingsName, channel.guild.id)) return;

		const guildData = this.data.getGuild(channel.guild.id);
		if (!guildData.isEnabled()) return;

		let needsSave = false;
		guildData.guild = channel.guild;
		if (guildData.categoryChannel.id === channel.id) {
			guildData.disable();
			guildData.categoryChannelID = undefined;
			guildData.createRoomChannelID = undefined;
			needsSave = true;
		}
		else if (guildData.createRoomChannel.id === channel.id) {
			guildData.disable();
			guildData.categoryChannelID = undefined;
			guildData.createRoomChannelID = undefined;
			needsSave = true;
		}
		for (const [voiceChannelID, roomData] of guildData.roomsByVoiceChannelID) {
			if (roomData.voiceChannel.id === channel.id) {
				guildData.roomsByVoiceChannelID.delete(voiceChannelID);
				needsSave = true;
				break;
			}
		}

		if (needsSave)
			await this.data.save();
	}

	protected async onVoiceStateUpdate(oldState: Discord.VoiceState, newState: Discord.VoiceState) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeSettingsName, newState.guild.id)) return;

		const guildData = this.data.getGuild(newState.guild.id);
		if (!guildData.isEnabled()) return;

		if (newState.channel && newState.channel.id === guildData.createRoomChannel.id) {
			const roomData = await this.makeRoomForMember(guildData, newState.member!);
			await newState.setChannel(roomData.voiceChannel);
			roomData.voiceMembers = newState.channel.members.map((v, k) => v).sort();
			await this.data.save();
			return;
		}

		// joined to voice
		if (!oldState.channel && newState.channel) {
			const roomData = guildData.roomsByVoiceChannelID.get(newState.channel.id);
			if (roomData) {
				roomData.voiceMembers = newState.channel.members.map((v, k) => v).sort();
				await this.data.save();
			}
		}
		// left voice
		else if (oldState.channel && !newState.channel) {
			const roomData = guildData.roomsByVoiceChannelID.get(oldState.channel.id);
			if (roomData) {
				roomData.voiceMembers = oldState.channel.members.map((v, k) => v).sort();
				const index = roomData.voiceMembers.indexOf(newState.member!);
				if (index > -1) roomData.voiceMembers.splice(index, 1);
				if (oldState.member!.id === roomData.owner.id) {
					if (roomData.voiceMembers.length > 0) {
						const oldOwner = roomData.owner;
						const newOwner = roomData.voiceMembers[0];
						await this.changeRoomOwner(roomData, newOwner);
						await roomData.voiceChannel.send({embeds: [new Discord.EmbedBuilder().setColor("Yellow").setDescription(`Права владельца канала были переданы <@${newOwner.id}>, так как предыдущий владелец <@${oldOwner.id}> покинул(а) канал`)]});
						await this.data.save();
					}
				}

				if (roomData.voiceMembers.length < 1) {
					guildData.roomsByVoiceChannelID.delete(oldState.channel.id);
					await oldState.channel.delete(`Последний участник ${oldState.member!.nickname} (${oldState.member!.id}) покинул комнату`);
					await this.data.save();
				}
			}
		}
	}

	async makeRoomForMember(guildData: Guild.Enabled, member: Discord.GuildMember) {
		const voiceChannel = await guildData.guild.channels.create({
			type: Discord.ChannelType.GuildVoice,
			name: guildData.roomVoiceChannelNameTemplate.replaceAll("%nickname%", member.nickname ?? member.user.displayName).replaceAll("%username%", member.user.username),
			parent: guildData.categoryChannel
		});
		await voiceChannel.permissionOverwrites.create(member.id, this.permissionsOwner);
		this.log.info("Created room for member", {args: {
			guild: `${member.guild.name} (${member.guild.id})`,
			user: `${member.user.username} (${member.user.id})`
		}});
		const roomData: Room = {voiceChannel, owner: member, voiceMembers: []};
		guildData.roomsByVoiceChannelID.set(voiceChannel.id, roomData);
		await this.data.save();
		return roomData;
	}

	async changeRoomOwner(roomData: Room, member: Discord.GuildMember) {
		if (roomData.voiceChannel.permissionOverwrites.cache.has(roomData.owner.id))
			await roomData.voiceChannel.permissionOverwrites.delete(roomData.owner.id);
		await roomData.voiceChannel.permissionOverwrites.create(member.id, this.permissionsOwner);
		roomData.owner = member;
		await this.data.save();
		return roomData;
	}
}
export default new DiscordRoomsModule();