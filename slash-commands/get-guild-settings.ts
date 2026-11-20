import Core from "../../../index.js";
import Module, { GuildState } from "../index.js";
import DiscordModule, { SlashCommand } from "../../discord/index.js";

import * as Discord from "discord.js";

export default () => {
	const c = new SlashCommand()
	.setVersion(1)
	.setName("rooms-get-guild-settings")
	.setDescription(`Sends settings of this server`)
	.setDescriptionLocalization("ru", `Отправляет настройки этого сервера`)
	.setChatInput(async(interaction) => {
		if (!interaction.inCachedGuild()) return;

		const start = Date.now();
		await interaction.deferReply();

		const args: any = {
			guild: DiscordModule.getGuildNameAndID(interaction.guild),
			member: DiscordModule.getGuildMemberNameAndID(interaction.member),
		};
		try {
			const state = Module.guilds.createAndGet(interaction.guild);
			await Module.data.save();

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
	return c;
};