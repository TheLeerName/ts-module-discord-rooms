import Core from "../../../index.js";
import Module, { GuildState } from "../index.js";
import DiscordModule, { SlashCommand } from "../../discord/index.js";

import * as Discord from "discord.js";

/** That command name uses for slash command allowing/banning system, if this will be banned on server, module will stop functioning on this server */
export const slashCommandChangeGuildSettingsName = "rooms-change-guild-settings";

export default () => {
	const c = new SlashCommand()
	.setVersion(1)
	.setName(slashCommandChangeGuildSettingsName)
	.setDescription(`Changes some settings for this server`)
	.setDescriptionLocalization("ru", `Изменяет настройки для этого сервера`)
	.setChatInput(async(interaction) => {
		if (!interaction.inCachedGuild()) return;

		const start = Date.now();
		await interaction.deferReply();

		const args: any = {
			guild: DiscordModule.getGuildNameAndID(interaction.guild),
			member: DiscordModule.getGuildMemberNameAndID(interaction.member),
		};
		try {
			const roomNameTemplate = interaction.options.getString("room-name-template") ?? undefined;
			args.roomNameTemplate = roomNameTemplate;

			const categoryChannel = interaction.options.getChannel<Discord.ChannelType.GuildCategory>("category-channel") ?? undefined;
			if (categoryChannel != null)
				args.categoryChannel = DiscordModule.getChannelNameAndID(categoryChannel);

			const createRoomChannel = interaction.options.getChannel<Discord.ChannelType.GuildVoice | Discord.ChannelType.GuildStageVoice>("create-room-channel") ?? undefined;
			if (createRoomChannel != null)
				args.createRoomChannel = DiscordModule.getChannelNameAndID(createRoomChannel);

			const state = Module.guilds.createAndGet(interaction.guild);
			state.roomVoiceChannelNameTemplate = roomNameTemplate;
			state.categoryChannel = categoryChannel;
			state.categoryChannelID = categoryChannel?.id;
			state.createRoomChannel = createRoomChannel;
			state.createRoomChannelID = createRoomChannel?.id;
			state.enabled = state.categoryChannel != null && state.createRoomChannel != null;
			await Module.data.save(true);

			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setFields(
					{
						name: "Канал-категория для создания комнаты",
						value: state.categoryChannelID ? `<#${state.categoryChannelID}>` : `*не установлено*`,
					},
					{
						name: "Голосовой канал для создания комнаты",
						value: state.createRoomChannelID ? `<#${state.createRoomChannelID}>` : `*не установлено*`,
					},
					{
						name: "Шаблон имени комнаты",
						value: `\`${state.roomVoiceChannelNameTemplate ?? GuildState.ROOM_VOICE_CHANNEL_NAME_TEMPLATE}\``,
					}
				)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});
			Module.log.info(`Command ${interaction.commandName} success`, {args});
		}
		catch(error) {
			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:x: Ошибка!`)
				.setDescription(`\`\`\`\n${error instanceof Error ? error.message : error}\n\`\`\``)
				.setColor("#dd2e44")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});

			Module.log.error(`Command ${interaction.commandName} failed`, {error, args});
		}
	});
	c.addStringOption(option => option
		.setName("room-name-template")
		.setDescription("Name template of each created room, placeholders are: %nickname%, %username%")
		.setDescriptionLocalization("ru", "Шаблон имени каждой новой созданной комнаты, заменяющие слова: %nickname%, %username%")
	)
	.addChannelOption(option => option
		.setName("category-channel")
		.setDescription("Category channel for creating rooms")
		.setDescriptionLocalization("ru", "Канал-категория для создания комнат")
		.addChannelTypes(Discord.ChannelType.GuildCategory)
	)
	.addChannelOption(option => option
		.setName("create-room-channel")
		.setDescription("Channel for creating new room")
		.setDescriptionLocalization("ru", "Канал для создания новой комнаты")
		.addChannelTypes(Discord.ChannelType.GuildVoice, Discord.ChannelType.GuildStageVoice)
	)
	return c;
};