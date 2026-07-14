/**
 * @name AutoQuest
 * @description Completa automaticamente as quests do Discord
 * @version 2.2.0
 * @author oinacioo
 */

module.exports = class AutoQuest {
    constructor() {
        this.interval = null;
        this.running = false;
        this.ui = null;
        this.elements = {};
        this.currentQuest = null;
        this.totalQuests = 0;
        this.completedQuests = 0;
        this.isUIVisible = true;
        // Variáveis para arraste
        this.dragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
    }

    start() {
        if (this.running) return;
        this.running = true;

        setTimeout(() => {
            try {
                this.run();
            } catch (err) {
                console.error('[AutoQuest] Erro:', err);
                this.running = false;
            }
        }, 2000);
    }

    stop() {
        this.running = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.ui) {
            this.ui.remove();
            this.ui = null;
            this.elements = {};
        }
        console.log('[AutoQuest] Plugin desativado.');
    }

    // =============== CRIAÇÃO DA INTERFACE ===============
    createUI(questName, totalSeconds) {
        if (this.ui) {
            this.ui.remove();
            this.ui = null;
            this.elements = {};
        }

        const container = document.createElement('div');
        container.id = 'autoquest-panel';
        // Usa left/top para facilitar o arraste
        container.style.cssText = `
            position: fixed;
            left: calc(100% - 320px);
            top: 60px;
            width: 300px;
            background: rgba(32, 34, 37, 0.95);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 999999;
            border: 1px solid #4a4d52;
            font-family: 'Whitney', 'Helvetica Neue', sans-serif;
            color: #fff;
            backdrop-filter: blur(4px);
            user-select: none;
            cursor: default;
        `;

        // Cabeçalho com título e botão de fechar
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            cursor: grab;
            padding: 4px 0;
        `;
        header.title = 'Arraste para mover';

        const titleWrap = document.createElement('div');
        titleWrap.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        const dragIcon = document.createElement('span');
        dragIcon.textContent = '⣿';
        dragIcon.style.cssText = `
            font-size: 14px;
            color: #72767d;
            cursor: grab;
        `;
        const title = document.createElement('span');
        title.textContent = '🎯 AutoQuest';
        title.style.cssText = `
            font-weight: 600;
            font-size: 14px;
            color: #b9bbbe;
        `;
        titleWrap.appendChild(dragIcon);
        titleWrap.appendChild(title);
        header.appendChild(titleWrap);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #72767d;
            cursor: pointer;
            font-size: 16px;
            padding: 0 4px;
        `;
        closeBtn.onclick = () => {
            container.style.display = 'none';
            this.isUIVisible = false;
        };
        header.appendChild(closeBtn);
        container.appendChild(header);

        // Nome da missão
        const questNameEl = document.createElement('div');
        questNameEl.style.cssText = `
            font-size: 15px;
            font-weight: 500;
            margin-bottom: 8px;
            color: #f2f3f5;
            word-break: break-word;
        `;
        questNameEl.textContent = questName || 'Aguardando...';
        container.appendChild(questNameEl);

        // Detalhes
        const detailsEl = document.createElement('div');
        detailsEl.style.cssText = `
            font-size: 12px;
            color: #b9bbbe;
            margin-bottom: 10px;
        `;
        detailsEl.textContent = '⏳ Iniciando...';
        container.appendChild(detailsEl);

        // Barra de progresso
        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = `
            background: #2f3136;
            border-radius: 6px;
            height: 8px;
            overflow: hidden;
            margin-bottom: 6px;
        `;
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #5865f2, #4752c4);
            border-radius: 6px;
            transition: width 0.5s ease;
        `;
        progressWrap.appendChild(progressBar);
        container.appendChild(progressWrap);

        // Texto do progresso
        const progressText = document.createElement('div');
        progressText.style.cssText = `
            font-size: 11px;
            color: #b9bbbe;
            text-align: right;
        `;
        progressText.textContent = '0%';
        container.appendChild(progressText);

        // Contador
        const counter = document.createElement('div');
        counter.style.cssText = `
            font-size: 11px;
            color: #72767d;
            margin-top: 8px;
            text-align: center;
            border-top: 1px solid #2f3136;
            padding-top: 8px;
        `;
        counter.textContent = '0 / 0 concluídas';
        container.appendChild(counter);

        document.body.appendChild(container);

        // Armazena referências
        this.ui = container;
        this.elements = {
            container,
            header,
            questName: questNameEl,
            details: detailsEl,
            progressBar,
            progressText,
            counter
        };
        this.isUIVisible = true;

        // ========== ADICIONA ARRASTE ==========
        this.makeDraggable(container, header);
    }

    // =============== FUNÇÃO DE ARRASTE ===============
    makeDraggable(container, handle) {
        let dragging = false;
        let offsetX = 0, offsetY = 0;

        const onMouseMove = (e) => {
            if (!dragging) return;
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;

            // Opcional: impede que o painel saia da tela
            const rect = container.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));

            container.style.left = newLeft + 'px';
            container.style.top = newTop + 'px';
            // Remove right/bottom se estiverem definidos
            container.style.right = 'auto';
            container.style.bottom = 'auto';
        };

        const onMouseUp = () => {
            if (dragging) {
                dragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                handle.style.cursor = 'grab';
            }
        };

        const onMouseDown = (e) => {
            // Ignora se clicou no botão de fechar ou em elementos interativos
            if (e.target.closest('button')) return;
            dragging = true;
            const rect = container.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            handle.style.cursor = 'grabbing';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        };

        handle.addEventListener('mousedown', onMouseDown);

        // Previne que o texto seja selecionado durante o arraste
        handle.addEventListener('dragstart', (e) => e.preventDefault());
    }

    // =============== ATUALIZA UI ===============
    updateUI(progress, total, questName, detailsText, completed, totalQuests) {
        if (!this.elements || !this.elements.container) {
            this.createUI(questName || 'Missão', total || 1);
        }

        if (!this.isUIVisible) {
            this.elements.container.style.display = '';
            this.isUIVisible = true;
        }

        const { progressBar, progressText, questName: nameEl, details: detailsEl, counter } = this.elements;

        if (progressBar) {
            const pct = Math.min(100, (progress / total) * 100);
            progressBar.style.width = pct + '%';
        }
        if (progressText) {
            progressText.textContent = `${Math.round((progress / total) * 100)}%  (${progress}/${total}s)`;
        }
        if (nameEl && questName) {
            nameEl.textContent = questName;
        }
        if (detailsEl && detailsText) {
            detailsEl.textContent = detailsText;
        }
        if (counter) {
            counter.textContent = `${completed || 0} / ${totalQuests || 0} concluídas`;
        }
    }

    // =============== LÓGICA PRINCIPAL ===============
    run() {
        delete window.$;
        let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();

        const ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
        const RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
        const QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
        const ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
        const GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;
        const FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
        const api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

        if (!api || !QuestsStore) {
            console.warn('[AutoQuest] Módulos essenciais não encontrados.');
            this.running = false;
            return;
        }

        function extractQuests(store) {
            if (!store) return [];
            for (let key in store) {
                let val = store[key];
                if (!val) continue;
                if (typeof val === 'object' && typeof val.values === 'function') {
                    try {
                        let arr = [...val.values()];
                        if (arr.length > 0 && arr[0]?.config?.application) return arr;
                    } catch(e) {}
                }
                if (Array.isArray(val)) {
                    if (val.length > 0 && val[0]?.config?.application) return val;
                }
                if (typeof val === 'object' && !Array.isArray(val) && val !== null) {
                    let values = Object.values(val);
                    if (values.length > 0 && values[0]?.config?.application) return values;
                }
            }
            if (store.quests) {
                if (typeof store.quests.values === 'function') {
                    try { return [...store.quests.values()]; } catch(e) {}
                }
                if (Array.isArray(store.quests)) return store.quests;
                if (typeof store.quests === 'object') return Object.values(store.quests);
            }
            return [];
        }

        const allQuests = extractQuests(QuestsStore);
        const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];

        let quests = allQuests.filter(x =>
            x.userStatus?.enrolledAt &&
            !x.userStatus?.completedAt &&
            new Date(x.config.expiresAt).getTime() > Date.now() &&
            supportedTasks.some(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y))
        );

        console.log(`[AutoQuest] ${quests.length} missões elegíveis.`);

        const isApp = typeof DiscordNative !== "undefined";

        if (quests.length === 0) {
            console.log("[AutoQuest] Nenhuma missão ativa.");
            this.running = false;
            return;
        }

        const firstQuest = quests[0];
        const taskConfig = firstQuest.config.taskConfig ?? firstQuest.config.taskConfigV2;
        const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
        const totalSecs = taskConfig.tasks[taskName].target;
        this.createUI(firstQuest.config.messages.questName, totalSecs);
        this.totalQuests = quests.length;
        this.completedQuests = 0;

        const doJob = () => {
            const quest = quests.pop();
            if (!quest) {
                console.log("[AutoQuest] Todas as missões concluídas!");
                this.updateUI(1, 1, '✅ Todas as missões concluídas!', 'Parabéns! 🎉', this.completedQuests, this.totalQuests);
                this.running = false;
                return;
            }

            const pid = Math.floor(Math.random() * 30000) + 1000;
            const applicationId = quest.config.application.id;
            const applicationName = quest.config.application.name;
            const questName = quest.config.messages.questName;
            const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
            const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
            if (!taskName) {
                console.log(`[AutoQuest] Missão "${questName}" sem tarefa suportada. Pulando.`);
                doJob();
                return;
            }
            const secondsNeeded = taskConfig.tasks[taskName].target;
            let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

            let detailsText = `🎮 ${applicationName}`;
            if (taskName === 'WATCH_VIDEO' || taskName === 'WATCH_VIDEO_ON_MOBILE') detailsText = `🎬 Assistindo vídeo`;
            else if (taskName === 'PLAY_ON_DESKTOP') detailsText = `🕹️ Jogando ${applicationName}`;
            else if (taskName === 'STREAM_ON_DESKTOP') detailsText = `📺 Transmitindo ${applicationName}`;
            else if (taskName === 'PLAY_ACTIVITY') detailsText = `📱 Atividade em canal de voz`;

            this.updateUI(secondsDone, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);

            // ---- WATCH_VIDEO ----
            if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
                const speed = 7;
                let completed = false;
                let fn = async () => {
                    while (true) {
                        const remaining = Math.min(speed, secondsNeeded - secondsDone);
                        await new Promise(resolve => setTimeout(resolve, remaining * 1000));
                        const timestamp = secondsDone + speed;
                        const res = await api.post({
                            url: `/quests/${quest.id}/video-progress`,
                            body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) }
                        });
                        completed = res.body.completed_at != null;
                        secondsDone = Math.min(secondsNeeded, timestamp);
                        this.updateUI(secondsDone, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);
                        if (timestamp >= secondsNeeded) break;
                    }
                    if (!completed) {
                        await api.post({
                            url: `/quests/${quest.id}/video-progress`,
                            body: { timestamp: secondsNeeded }
                        });
                    }
                    this.completedQuests++;
                    console.log(`[AutoQuest] Missão "${questName}" concluída (vídeo)!`);
                    doJob();
                };
                fn();
            }

            // ---- PLAY_ON_DESKTOP ----
            else if (taskName === "PLAY_ON_DESKTOP") {
                if (!isApp) {
                    console.log(`[AutoQuest] Missão "${questName}" requer desktop. Pulando.`);
                    doJob();
                } else {
                    api.get({ url: `/applications/public?application_ids=${applicationId}` }).then(res => {
                        const appData = res.body[0];
                        const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">", "") ?? appData.name.replace(/[\/\\:*?"<>|]/g, "");
                        const fakeGame = {
                            cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
                            exeName,
                            exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
                            hidden: false,
                            isLauncher: false,
                            id: applicationId,
                            name: appData.name,
                            pid: pid,
                            pidPath: [pid],
                            processName: appData.name,
                            start: Date.now(),
                        };
                        const realGames = RunningGameStore.getRunningGames();
                        const fakeGames = [fakeGame];
                        const realGetRunningGames = RunningGameStore.getRunningGames;
                        const realGetGameForPID = RunningGameStore.getGameForPID;
                        RunningGameStore.getRunningGames = () => fakeGames;
                        RunningGameStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid);
                        FluxDispatcher.dispatch({
                            type: "RUNNING_GAMES_CHANGE",
                            removed: realGames,
                            added: [fakeGame],
                            games: fakeGames
                        });

                        let fn = (data) => {
                            let progress = quest.config.configVersion === 1
                                ? data.userStatus.streamProgressSeconds
                                : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
                            this.updateUI(progress, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);
                            if (progress >= secondsNeeded) {
                                console.log(`[AutoQuest] Missão "${questName}" concluída (jogo)!`);
                                RunningGameStore.getRunningGames = realGetRunningGames;
                                RunningGameStore.getGameForPID = realGetGameForPID;
                                FluxDispatcher.dispatch({
                                    type: "RUNNING_GAMES_CHANGE",
                                    removed: [fakeGame],
                                    added: [],
                                    games: []
                                });
                                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                                this.completedQuests++;
                                doJob();
                            }
                        };
                        FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                    });
                }
            }

            // ---- STREAM_ON_DESKTOP ----
            else if (taskName === "STREAM_ON_DESKTOP") {
                if (!isApp) {
                    console.log(`[AutoQuest] Missão "${questName}" requer desktop. Pulando.`);
                    doJob();
                } else {
                    const realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
                    ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
                        id: applicationId,
                        pid,
                        sourceName: null
                    });

                    let fn = (data) => {
                        let progress = quest.config.configVersion === 1
                            ? data.userStatus.streamProgressSeconds
                            : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
                        this.updateUI(progress, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);
                        if (progress >= secondsNeeded) {
                            console.log(`[AutoQuest] Missão "${questName}" concluída (stream)!`);
                            ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                            FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                            this.completedQuests++;
                            doJob();
                        }
                    };
                    FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                }
            }

            // ---- PLAY_ACTIVITY ----
            else if (taskName === "PLAY_ACTIVITY") {
                let channelId = ChannelStore.getSortedPrivateChannels()[0]?.id;
                if (!channelId) {
                    const guilds = GuildChannelStore.getAllGuilds();
                    for (let key in guilds) {
                        const guild = guilds[key];
                        if (guild && guild.VOCAL && guild.VOCAL.length > 0) {
                            channelId = guild.VOCAL[0].channel.id;
                            break;
                        }
                    }
                }
                if (!channelId) {
                    console.log("[AutoQuest] Nenhum canal de voz encontrado. Entre em um e tente novamente.");
                    doJob();
                    return;
                }
                const streamKey = `call:${channelId}:1`;
                let fn = async () => {
                    while (true) {
                        const res = await api.post({
                            url: `/quests/${quest.id}/heartbeat`,
                            body: { stream_key: streamKey, terminal: false }
                        });
                        const progress = res.body.progress.PLAY_ACTIVITY.value;
                        this.updateUI(progress, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);
                        await new Promise(resolve => setTimeout(resolve, 20 * 1000));
                        if (progress >= secondsNeeded) {
                            await api.post({
                                url: `/quests/${quest.id}/heartbeat`,
                                body: { stream_key: streamKey, terminal: true }
                            });
                            break;
                        }
                    }
                    console.log(`[AutoQuest] Missão "${questName}" concluída (atividade)!`);
                    this.completedQuests++;
                    doJob();
                };
                fn();
            }
        };

        doJob();
    }
};