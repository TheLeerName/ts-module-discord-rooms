import * as Core from "../../index.js";
import { type Module as DiscordModule } from "../discord/index.js";
import { GuildStateManager } from "./managers/guild.js";
import SlashCommandCreateCategory from "./slash-commands/create-category.js";
import SlashCommandChangeGuildSettings from "./slash-commands/change-guild-settings.js";
import SlashCommandGetGuildSettings from "./slash-commands/get-guild-settings.js";
import SlashCommandChangeOwner from "./slash-commands/change-owner.js";

import {
	type PermissionOverwriteOptions,
	type Guild,
	PermissionFlagsBits,
	GatewayIntentBits,
	Partials,
} from "discord.js";

export class Module {
	readonly initializeBefore = ["discord"];
	readonly name = "discord-rooms" as const;
	readonly data: Data;
	readonly log: Core.ModuleLogFunctions;
	readonly core: Core.Core;
	readonly discord: DiscordModule;
	readonly guilds: GuildStateManager;

	isAllowedInGuild(guild: Guild) {
		return this.discord.slashCommands.isCommandInGuildAllowed(SlashCommandChangeGuildSettings().name, guild.id);
	}

	readonly permissionsOwner: PermissionOverwriteOptions = {ViewChannel: true, ManageChannels: true, ManageRoles: true, ManageMessages: true, PinMessages: true, BypassSlowmode: true, ManageThreads: true, MuteMembers: true, DeafenMembers: true, MoveMembers: true};

	async initialize() {
		//throw new Error("nope.");

		const discord = Core.default.modules.getInstance<DiscordModule>("discord");
		if (discord == null) return;

		Core.default.modules.setReadonlyFields(this, {
			data: new Data(this),
			core: Core.default,
			log: Core.default.log.makeFunctions(this.name),
			discord,
			guilds: new GuildStateManager(),
		});
		this.data.initialize();

		this.discord
			.addPermissions(PermissionFlagsBits.Administrator) // bot cant give room owners ManageRoles in rooms, so it works only with this
			.addPartials(Partials.Channel)
			.addIntents(GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates)
			.once("afterClientCreation", () => this.afterDiscordClientCreation());
	}

	protected afterDiscordClientCreation() {
		SlashCommandCreateCategory();
		SlashCommandChangeGuildSettings();
		SlashCommandGetGuildSettings();
		SlashCommandChangeOwner();
		this.guilds.registerDiscordCallbacks();
	}
}

export class Data extends Core.BaseData {
	/** If this `true`, next call of {@link save()} will save data */
	needsSave = false;

	protected module: Module;

	initialize() {
		const json = this.getSavedFields();
		this.needsSave = true;

		this.needsSave = !this.registerFieldArray(json, "guilds",
			savedValue => this.module.guilds.fromJSON(savedValue),
			() => this.module.guilds.toJSON(),
		);

		this.save();
		return this;
	}

	async save(force?: boolean) {
		if (force || this.needsSave) {
			await super.save();
			this.needsSave = false;
		}
	}
}

export default new Module();

export * from "./managers/guild.js";
export * from "./managers/room.js";