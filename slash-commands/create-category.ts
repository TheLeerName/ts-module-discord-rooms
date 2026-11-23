import Module from "../index.js";
import { EmbedBuilder, ChannelType } from "discord.js";

export default () => Module.discord.slashCommands.make("rooms-create-category", c => {c
.setVersion(1)
.setDescription(`Creates category for private rooms`)
.setDescriptionLocalization("ru", `Создаёт канал-категорию для приватных комнат`)
.setChatInput(async(interaction) => {
	if (!interaction.inCachedGuild()) return;

	const start = Date.now();
	await interaction.deferReply();

	const args: any = {
		guild: Module.discord.getGuildNameAndID(interaction.guild),
		member: Module.discord.getGuildMemberNameAndID(interaction.member),
	};
	try {
		const categoryName = interaction.options.getString("category-name", true);
		args.categoryName = categoryName;
		const createRoomName = interaction.options.getString("create-room-name", true);
		args.createRoomName = createRoomName;

		const state = Module.guilds.createAndGet(interaction.guild);
		if (state.enabled)
			throw new Error("Канал-категория уже был создан!");

		state.guild = interaction.guild;

		state.categoryChannel = await state.guild.channels.create({
			type: ChannelType.GuildCategory,
			name: categoryName,
		});
		state.categoryChannelID = state.categoryChannel.id;
		args.categoryChannel = Module.discord.getChannelNameAndID(state.categoryChannel);

		state.createRoomChannel = await state.guild.channels.create({
			type: ChannelType.GuildVoice,
			name: createRoomName,
			parent: state.categoryChannel,
			userLimit: 1,
		});
		state.createRoomChannelID = state.createRoomChannel.id;
		args.createRoomChannel = Module.discord.getChannelNameAndID(state.createRoomChannel);

		state.enabled = true;
		await Module.data.save(true);

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Успешно!`)
			.setFields(
				{
					name: "Канал-категория для создания комнаты",
					value: `<#${state.createRoomChannel.id}>`,
				},
				{
					name: "Голосовой канал для создания комнаты",
					value: `<#${state.createRoomChannel.id}>`,
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
c.addStringOption(option => option
	.setMinLength(1)
	.setMaxLength(100)
	.setRequired(true)
	.setName("category-name")
	.setDescription("Имя канала-категории")
).addStringOption(option => option
	.setMinLength(1)
	.setMaxLength(100)
	.setRequired(true)
	.setName("create-room-name")
	.setDescription("Имя голосового канала для создания комнаты")
);
return c});