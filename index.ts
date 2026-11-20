import Core from "../../index.js";
import DiscordModule from "../discord/index.js";
import ModuleData from "./data.js";
import { GuildStateManager } from "./managers/guild.js";
import SlashCommandCreateCategory from "./slash-commands/create-category.js";
import SlashCommandChangeGuildSettings from "./slash-commands/change-guild-settings.js";
import SlashCommandGetGuildSettings from "./slash-commands/get-guild-settings.js";
import SlashCommandChangeOwner from "./slash-commands/change-owner.js";

import * as Discord from "discord.js";

export class DiscordRoomsModule {
	readonly name = "discord-rooms" as const;
	readonly data: ModuleData;
	readonly log = Core.log.makeFunctions(this.name);

	isDisabled = () => false;

	readonly guilds: GuildStateManager = new GuildStateManager();

	readonly permissionsOwner: Discord.PermissionOverwriteOptions = {ViewChannel: true, ManageChannels: true, ManageRoles: true, ManageMessages: true, PinMessages: true, BypassSlowmode: true, ManageThreads: true, MuteMembers: true, DeafenMembers: true, MoveMembers: true};

	constructor() {
		if (this.isDisabled()) return;
		this.data = new ModuleData(this).initialize();

		DiscordModule
			.once("addAuthorizationFields", a => a
				.addPermissions(
					Discord.PermissionFlagsBits.Administrator, // bot cant give room owners ManageRoles in rooms, so it works only with this
				)
				.addScopes(Discord.OAuth2Scopes.Guilds)
				.addPartials(Discord.Partials.Channel, Discord.Partials.GuildMember, Discord.Partials.User)
				.addIntents(Discord.GatewayIntentBits.GuildMembers, Discord.GatewayIntentBits.GuildModeration, Discord.GatewayIntentBits.GuildVoiceStates, Discord.GatewayIntentBits.Guilds))
			.once("afterClientCreation", () => this.afterDiscordClientCreation());
	}

	protected afterDiscordClientCreation() {
		DiscordModule.slashCommands.push(SlashCommandCreateCategory(), SlashCommandChangeGuildSettings(), SlashCommandGetGuildSettings(), SlashCommandChangeOwner());
		this.guilds.registerDiscordCallbacks();
	}
}
export default new DiscordRoomsModule();

export { GuildStateManager, type GuildStateManagerSave } from "./managers/guild.js";
export { RoomStateManager, type RoomStateManagerSave } from "./managers/room.js";

export { GuildState, type GuildStateAvailable, type GuildStateSave } from "./states/guild.js";
export { RoomState, type RoomStateAvailable, type RoomStateSave } from "./states/room.js";

export { slashCommandChangeGuildSettingsName } from "./slash-commands/change-guild-settings.js";