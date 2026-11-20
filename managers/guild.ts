import Module, {
	GuildState,
	type GuildStateSave,
	type GuildStateAvailable,
	slashCommandChangeGuildSettingsName,
} from "../index.js";
import DiscordModule from "../../discord/index.js";

import type {
	Guild,
	CategoryChannel,
	DMChannel,
	NonThreadGuildBasedChannel,
	VoiceBasedChannel,
	VoiceState,
} from "discord.js";

export type GuildStateManagerSave = GuildStateSave[];

export class GuildStateManager extends Map<string, GuildState> {
	protected _availableGuildsCount = 0;

	/** NOTE: this method may set {@link Module.data.needsSave} to `true` */
	createAndGet(guild: Guild): GuildState {
		let state = this.get(guild.id);
		if (state == null) {
			state = new GuildState(this);
			state.guild = guild;
			state.guildID = guild.id;
			this.set(guild.id, state);
			Module.data.needsSave = true;
			Module.log.warn("Guild state was created without guildCreate event", {args: {
				guild: state.getGuildName(),
			}});
		}
		return state;
	}
	registerDiscordCallbacks() {
		DiscordModule.client
			.on("guildCreate", g => this.onGuildCreate(g))
			.on("guildUpdate", (oldGuild, newGuild) => this.onGuildUpdate(oldGuild, newGuild))
			.on("guildDelete", g => this.onGuildDelete(g))
			.on("guildAvailable", g => this.onGuildAvailable(g))
			.on("guildUnavailable", g => this.onGuildUnavailable(g))
			.on("channelUpdate", (oldChannel, newChannel) => this.onChannelUpdate(oldChannel, newChannel))
			.on("channelDelete", channel => this.onChannelDelete(channel))
			.on("voiceStateUpdate", (oldState, newState) => this.onVoiceStateUpdate(oldState, newState));
	}

	fromJSON(json: GuildStateManagerSave) {
		for (const entry of json) {
			const state = new GuildState(this);
			state.fromJSON(entry);
			this.set(entry.guildID, state);
		}
	}
	toJSON(): GuildStateManagerSave {
		return Array.from(this.values()).map(g => g.toJSON());
	}

	protected onGuildCreate(guild: Guild) {
		this._availableGuildsCount++;

		let state = this.get(guild.id);
		if (state != null) {
			state.guild = guild;
			state.guildID = guild.id;
		}
		else {
			state = new GuildState(this);
			state.guild = guild;
			state.guildID = guild.id;
			this.set(guild.id, state);
			Module.data.needsSave = true;
		}
		Module.data.save();
	}
	protected onGuildUpdate(oldGuild: Guild, newGuild: Guild) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeGuildSettingsName, newGuild.id)) return;

		const state = this.get(newGuild.id);
		if (state == null || !state.enabled) return;

		state.guild = newGuild;
	}
	protected onGuildDelete(guild: Guild) {
		this._availableGuildsCount--;

		const state = this.get(guild.id);
		if (state == null) return;

		state.guild = state.guild;
	}
	protected async onGuildAvailable(guild: Guild) {
		this._availableGuildsCount++;

		// TODO: put this to index.js like isAllowedInGuild
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeGuildSettingsName, guild.id)) return;

		const state = this.get(guild.id);
		if (state == null || !state.enabled) return;

		state.guild = guild;
		state.guildID = guild.id;
		await state.setCategoryChannelFromFetch();
		await state.setCreateRoomChannelFromFetch();
		await state.rooms.onGuildAvailable(state as GuildStateAvailable);
		if (this._availableGuildsCount >= DiscordModule.client.guilds.cache.size)
			Module.data.save(true);
	}
	protected onGuildUnavailable(guild: Guild) {
		this._availableGuildsCount--;

		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeGuildSettingsName, guild.id)) return;

		const state = this.get(guild.id);
		if (state == null) return;

		state.guild = guild;
	}
	protected onChannelUpdate(oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel) {
		if (newChannel.isDMBased()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeGuildSettingsName, newChannel.guild.id)) return;

		const state = this.get(newChannel.guild.id);
		if (state == null || !state.enabled) return;

		if (state.categoryChannelID === newChannel.id)
			state.categoryChannel = newChannel as CategoryChannel;
		if (state.createRoomChannelID === newChannel.id)
			state.createRoomChannel = newChannel as VoiceBasedChannel;

		for (const room of state.rooms.values()) {
			if (room.voiceChannelID === newChannel.id) {
				room.voiceChannel = newChannel as VoiceBasedChannel;
				break;
			}
		}
	}
	protected onChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel) {
		if (channel.isDMBased()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeGuildSettingsName, channel.guild.id)) return;

		const state = this.get(channel.guild.id);
		if (state == null || !state.enabled) return;

		if (state.categoryChannelID === channel.id) {
			delete state.categoryChannel;
			delete state.categoryChannelID;
			state.enabled = false;
			Module.data.needsSave = true;
		}
		else if (state.createRoomChannelID === channel.id) {
			delete state.createRoomChannel;
			delete state.createRoomChannelID;
			state.enabled = false;
			Module.data.needsSave = true;
		}
		else {
			for (const room of state.rooms.values()) {
				if (room.voiceChannelID === channel.id) {
					state.rooms.delete(room.voiceChannelID);
					Module.data.needsSave = true;
					break;
				}
			}
		}

		Module.data.save();
	}
	protected onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandChangeGuildSettingsName, newState.guild.id)) return;

		const state = this.get(newState.guild.id);
		if (state == null || !state.isAvailable()) return;

		state.rooms.onVoiceStateUpdate(oldState, newState);
	}
}