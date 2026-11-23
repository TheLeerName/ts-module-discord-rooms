import Module, { GuildState } from "../index.js";
import { EmbedBuilder } from "discord.js";

export default () => Module.discord.slashCommands.make("rooms-get-guild-settings", c => {c
.setVersion(1)
.setDescription(`Sends settings of this server`)
.setDescriptionLocalization("ru", `Отправляет настройки этого сервера`)
.setChatInput(async(interaction) => {
	if (!interaction.inCachedGuild()) return;

	const start = Date.now();
	await interaction.deferReply();

	const args: any = {
		guild: Module.discord.getGuildNameAndID(interaction.guild),
		member: Module.discord.getGuildMemberNameAndID(interaction.member),
	};
	try {
		const state = Module.guilds.createAndGet(interaction.guild);
		await Module.data.save();

		await interaction.editReply({embeds: [new EmbedBuilder()
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
			.setFooter({text: `Время обработки: ${Module.core.humanizeDuration(Date.now() - start)}`})
		]});
		Module.log.info(`Command ${interaction.commandName} success`, {args});
	}
	catch(error) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error instanceof Error ? error.message : error}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${Module.core.humanizeDuration(Date.now() - start)}`})
		]});

		Module.log.error(`Command ${interaction.commandName} failed`, {error, args});
	}
});
return c});