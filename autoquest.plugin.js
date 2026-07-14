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
        this.totalQuests = 0;
        this.completedQuests = 0;
        this.isUIVisible = true;
        this.panelLeft = null;
        this.panelTop = null;

        this.activeQuestId = null;
        this.activeTaskName = null;
        this.activeSecondsNeeded = 0;
        this.activeQuestName = '';
        this.activeDetailsText = '';

        this.syncInterval = null;
        this._lastLoggedProgress = -1;

        this.QuestsStore = null;
        this.api = null;
        this.RunningGameStore = null;
        this.ApplicationStreamingStore = null;
        this.ChannelStore = null;
        this.GuildChannelStore = null;
        this.FluxDispatcher = null;
        this.isApp = false;
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
        this.clearSyncInterval();
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        const existing = document.getElementById('autoquest-panel');
        if (existing) existing.remove();
        this.ui = null;
        this.elements = {};
        this.activeQuestId = null;
        console.log('[AutoQuest] Plugin desativado.');
    }

    clearSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            // console.log('[AutoQuest] Intervalo de sincronização limpo.');
        }
    }

    // =============== CRIAÇÃO DA INTERFACE ===============
    createUI(questName, totalSeconds) {
        // Remove qualquer painel existente
        const existing = document.getElementById('autoquest-panel');
        if (existing) {
            const rect = existing.getBoundingClientRect();
            if (!this.panelLeft && !this.panelTop) {
                this.panelLeft = rect.left;
                this.panelTop = rect.top;
            }
            existing.remove();
        }

        if (this.ui) {
            this.ui = null;
            this.elements = {};
        }

        const container = document.createElement('div');
        container.id = 'autoquest-panel';
        
        const left = this.panelLeft !== null ? this.panelLeft : (window.innerWidth - 280);
        const top = this.panelTop !== null ? this.panelTop : 60;
        
        container.style.cssText = `
            position: fixed;
            left: ${left}px;
            top: ${top}px;
            width: 260px;
            background: rgba(32, 34, 37, 0.95);
            border-radius: 12px;
            padding: 14px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 999999;
            border: 1px solid #4a4d52;
            font-family: 'Whitney', 'Helvetica Neue', sans-serif;
            color: #fff;
            backdrop-filter: blur(4px);
            user-select: none;
            cursor: default;
        `;

        // Cabeçalho
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            cursor: grab;
            padding: 2px 0;
        `;
        header.title = 'Arraste para mover';

        const titleWrap = document.createElement('div');
        titleWrap.style.cssText = `display: flex; align-items: center; gap: 6px;`;
        const dragIcon = document.createElement('span');
        dragIcon.textContent = '⣿';
        dragIcon.style.cssText = `font-size: 14px; color: #72767d; cursor: grab;`;
        const title = document.createElement('span');
        title.textContent = '🎯 AutoQuest';
        title.style.cssText = `font-weight: 600; font-size: 13px; color: #b9bbbe;`;
        titleWrap.appendChild(dragIcon);
        titleWrap.appendChild(title);
        header.appendChild(titleWrap);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `background: none; border: none; color: #72767d; cursor: pointer; font-size: 14px; padding: 0 4px;`;
        closeBtn.onclick = () => {
            container.style.display = 'none';
            this.isUIVisible = false;
            // Quando o usuário fecha o painel, limpamos o intervalo para evitar spam
            this.clearSyncInterval();
        };
        header.appendChild(closeBtn);
        container.appendChild(header);

        const questNameEl = document.createElement('div');
        questNameEl.style.cssText = `font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #f2f3f5; word-break: break-word;`;
        questNameEl.textContent = questName || 'Aguardando...';
        container.appendChild(questNameEl);

        const detailsEl = document.createElement('div');
        detailsEl.style.cssText = `font-size: 11px; color: #b9bbbe; margin-bottom: 8px;`;
        detailsEl.textContent = '⏳ Iniciando...';
        container.appendChild(detailsEl);

        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = `background: #2f3136; border-radius: 4px; height: 6px; overflow: hidden; margin-bottom: 4px;`;
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `width: 0%; height: 100%; background: linear-gradient(90deg, #5865f2, #4752c4); border-radius: 4px; transition: width 0.4s ease;`;
        progressWrap.appendChild(progressBar);
        container.appendChild(progressWrap);

        const progressText = document.createElement('div');
        progressText.style.cssText = `font-size: 12px; color: #b9bbbe; text-align: right; font-weight: 500;`;
        progressText.textContent = '0%';
        container.appendChild(progressText);

        const counter = document.createElement('div');
        counter.style.cssText = `font-size: 10px; color: #72767d; margin-top: 6px; text-align: center; border-top: 1px solid #2f3136; padding-top: 6px;`;
        counter.textContent = `${this.completedQuests || 0} / ${this.totalQuests || 0} concluídas`;
        container.appendChild(counter);

        document.body.appendChild(container);

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

        this.makeDraggable(container, header);
    }

    makeDraggable(container, handle) {
        let dragging = false;
        let offsetX = 0, offsetY = 0;

        const onMouseMove = (e) => {
            if (!dragging) return;
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;

            const rect = container.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));

            container.style.left = newLeft + 'px';
            container.style.top = newTop + 'px';
            container.style.right = 'auto';
            container.style.bottom = 'auto';

            this.panelLeft = newLeft;
            this.panelTop = newTop;
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
        handle.addEventListener('dragstart', (e) => e.preventDefault());
    }

    // =============== ATUALIZA UI (APENAS SE EXISTIR) ===============
    updateUI(progress, total, questName, detailsText, completed, totalQuests) {
        // Verifica se a UI existe no DOM
        const panel = document.getElementById('autoquest-panel');
        if (!panel) {
            // UI foi removida – não tenta atualizar
            return;
        }

        // Se a referência interna estiver desatualizada, atualiza
        if (!this.elements || this.elements.container !== panel) {
            // Reconstroi as referências a partir do DOM (caso necessário)
            // Mas como estamos usando createUI, isso não deve acontecer.
            // Apenas retorna para evitar erro.
            return;
        }

        if (!this.isUIVisible) {
            panel.style.display = '';
            this.isUIVisible = true;
        }

        progress = Number(progress) || 0;
        total = Number(total) || 1;

        const { progressBar, progressText, questName: nameEl, details: detailsEl, counter } = this.elements;

        const pct = Math.min(100, (progress / total) * 100);
        const displayPct = Math.round(pct);

        if (progressBar) {
            progressBar.style.width = pct + '%';
        }

        if (progressText) {
            progressText.textContent = `${displayPct}%`;
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

    // =============== SINCRONIZAÇÃO (CORRIGIDA) ===============
    startSync() {
        this.clearSyncInterval();
        this.syncNow(); // atualização imediata
        this.syncInterval = setInterval(() => {
            this.syncNow();
        }, 3000);
    }

    syncNow() {
        // 🔥 Verifica se a UI existe no DOM usando o ID
        const panel = document.getElementById('autoquest-panel');
        if (!panel) {
            // UI foi removida – limpa o intervalo e sai (sem logs)
            this.clearSyncInterval();
            return;
        }

        // Se a UI existe, mas a referência interna está desatualizada, atualiza-a
        if (!this.elements || this.elements.container !== panel) {
            // Atualiza as referências (reconstrói o objeto elements a partir do DOM)
            this.elements = {
                container: panel,
                header: panel.querySelector('div:first-child'),
                questName: panel.querySelector('div:nth-child(2)'),
                details: panel.querySelector('div:nth-child(3)'),
                progressBar: panel.querySelector('div:nth-child(4) div'),
                progressText: panel.querySelector('div:nth-child(5)'),
                counter: panel.querySelector('div:last-child')
            };
            // Se algo estiver faltando, podemos recriar, mas é mais seguro apenas sair
            if (!this.elements.progressBar || !this.elements.progressText) {
                // Recria a UI completamente (isso vai chamar createUI e limpar o intervalo)
                this.createUI(this.activeQuestName || 'Missão', this.activeSecondsNeeded || 1);
                // Após recriar, o intervalo será reiniciado, então podemos sair
                return;
            }
        }

        if (!this.activeQuestId || !this.QuestsStore) return;

        try {
            const quest = this.QuestsStore.getQuest(this.activeQuestId);
            if (!quest) {
                // Quest não encontrada (pode ter sido concluída)
                return;
            }

            const progress = quest.userStatus?.progress?.[this.activeTaskName]?.value ?? 0;
            const total = this.activeSecondsNeeded;

            if (quest.userStatus?.completedAt) {
                this.updateUI(total, total, this.activeQuestName, this.activeDetailsText, this.completedQuests, this.totalQuests);
                return;
            }

            this.updateUI(progress, total, this.activeQuestName, this.activeDetailsText, this.completedQuests, this.totalQuests);

            // Log único a cada mudança de progresso
            const currentFloor = Math.floor(progress);
            if (currentFloor !== Math.floor(this._lastLoggedProgress) || progress === 0) {
                console.log(`[AutoQuest] Progresso (${this.activeQuestName}): ${currentFloor}/${total} (${Math.round((progress/total)*100)}%)`);
                this._lastLoggedProgress = progress;
            }
        } catch (e) {
            // Ignora erros
        }
    }

    // =============== LÓGICA PRINCIPAL ===============
    run() {
        delete window.$;
        let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();

        this.ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
        this.RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
        this.QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
        this.ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
        this.GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;
        this.FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
        this.api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

        if (!this.api || !this.QuestsStore) {
            console.warn('[AutoQuest] Módulos essenciais não encontrados.');
            this.running = false;
            return;
        }

        this.isApp = typeof DiscordNative !== "undefined";

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

        const allQuests = extractQuests(this.QuestsStore);
        const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];

        let quests = allQuests.filter(x =>
            x.userStatus?.enrolledAt &&
            !x.userStatus?.completedAt &&
            new Date(x.config.expiresAt).getTime() > Date.now() &&
            supportedTasks.some(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y))
        );

        console.log(`[AutoQuest] ${quests.length} missões elegíveis.`);

        if (quests.length === 0) {
            console.log("[AutoQuest] Nenhuma missão ativa.");
            this.running = false;
            return;
        }

        this.totalQuests = quests.length;
        this.completedQuests = 0;

        const doJob = () => {
            const quest = quests.pop();
            if (!quest) {
                console.log("[AutoQuest] Todas as missões concluídas!");
                this.clearSyncInterval();
                const panel = document.getElementById('autoquest-panel');
                if (panel) {
                    this.updateUI(1, 1, '✅ Todas as missões concluídas!', 'Parabéns! 🎉', this.completedQuests, this.totalQuests);
                }
                this.running = false;
                return;
            }

            this.clearSyncInterval(); // limpa intervalo anterior

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

            this.activeQuestId = quest.id;
            this.activeTaskName = taskName;
            this.activeSecondsNeeded = secondsNeeded;
            this.activeQuestName = questName;
            this.activeDetailsText = detailsText;
            this._lastLoggedProgress = -1;

            this.createUI(questName, secondsNeeded);
            this.updateUI(secondsDone, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);

            // Inicia sincronização (intervalo)
            this.startSync();

            // ---- WATCH_VIDEO ----
            if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
                const speed = 7;
                let completed = false;
                let fn = async () => {
                    while (true) {
                        const remaining = Math.min(speed, secondsNeeded - secondsDone);
                        await new Promise(resolve => setTimeout(resolve, remaining * 1000));
                        const timestamp = secondsDone + speed;
                        const res = await this.api.post({
                            url: `/quests/${quest.id}/video-progress`,
                            body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) }
                        });
                        completed = res.body.completed_at != null;
                        const serverProgress = res.body.progress?.[taskName]?.value ?? secondsDone;
                        secondsDone = Math.min(secondsNeeded, timestamp);
                        this.updateUI(serverProgress, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);
                        if (timestamp >= secondsNeeded) break;
                    }
                    if (!completed) {
                        const res = await this.api.post({
                            url: `/quests/${quest.id}/video-progress`,
                            body: { timestamp: secondsNeeded }
                        });
                        const finalProgress = res.body.progress?.[taskName]?.value ?? secondsNeeded;
                        this.updateUI(finalProgress, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);
                    }
                    this.completedQuests++;
                    console.log(`[AutoQuest] Missão "${questName}" concluída (vídeo)!`);
                    this.clearSyncInterval();
                    doJob();
                };
                fn();
            }

            // ---- PLAY_ON_DESKTOP ----
            else if (taskName === "PLAY_ON_DESKTOP") {
                if (!this.isApp) {
                    console.log(`[AutoQuest] Missão "${questName}" requer desktop. Pulando.`);
                    this.clearSyncInterval();
                    doJob();
                } else {
                    this.api.get({ url: `/applications/public?application_ids=${applicationId}` }).then(res => {
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
                        const realGames = this.RunningGameStore.getRunningGames();
                        const fakeGames = [fakeGame];
                        const realGetRunningGames = this.RunningGameStore.getRunningGames;
                        const realGetGameForPID = this.RunningGameStore.getGameForPID;
                        this.RunningGameStore.getRunningGames = () => fakeGames;
                        this.RunningGameStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid);
                        this.FluxDispatcher.dispatch({
                            type: "RUNNING_GAMES_CHANGE",
                            removed: realGames,
                            added: [fakeGame],
                            games: fakeGames
                        });

                        const checkCompletion = (data) => {
                            if (!this.activeQuestId || this.activeQuestId !== quest.id) return;
                            let progress = quest.config.configVersion === 1
                                ? data.userStatus.streamProgressSeconds
                                : data.userStatus.progress.PLAY_ON_DESKTOP.value;
                            if (progress === undefined || progress === null) return;
                            if (progress >= secondsNeeded) {
                                console.log(`[AutoQuest] Missão "${questName}" concluída (jogo)!`);
                                this.RunningGameStore.getRunningGames = realGetRunningGames;
                                this.RunningGameStore.getGameForPID = realGetGameForPID;
                                this.FluxDispatcher.dispatch({
                                    type: "RUNNING_GAMES_CHANGE",
                                    removed: [fakeGame],
                                    added: [],
                                    games: []
                                });
                                this.FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", checkCompletion);
                                this.completedQuests++;
                                this.clearSyncInterval();
                                doJob();
                            }
                        };
                        this.FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", checkCompletion);
                        // sync já está rodando
                    });
                }
            }

            // ---- STREAM_ON_DESKTOP ----
            else if (taskName === "STREAM_ON_DESKTOP") {
                if (!this.isApp) {
                    console.log(`[AutoQuest] Missão "${questName}" requer desktop. Pulando.`);
                    this.clearSyncInterval();
                    doJob();
                } else {
                    const realFunc = this.ApplicationStreamingStore.getStreamerActiveStreamMetadata;
                    this.ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
                        id: applicationId,
                        pid,
                        sourceName: null
                    });

                    const checkCompletion = (data) => {
                        if (!this.activeQuestId || this.activeQuestId !== quest.id) return;
                        let progress = quest.config.configVersion === 1
                            ? data.userStatus.streamProgressSeconds
                            : data.userStatus.progress.STREAM_ON_DESKTOP.value;
                        if (progress === undefined || progress === null) return;
                        if (progress >= secondsNeeded) {
                            console.log(`[AutoQuest] Missão "${questName}" concluída (stream)!`);
                            this.ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                            this.FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", checkCompletion);
                            this.completedQuests++;
                            this.clearSyncInterval();
                            doJob();
                        }
                    };
                    this.FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", checkCompletion);
                    this.startSync();
                }
            }

            // ---- PLAY_ACTIVITY ----
            else if (taskName === "PLAY_ACTIVITY") {
                let channelId = this.ChannelStore.getSortedPrivateChannels()[0]?.id;
                if (!channelId) {
                    const guilds = this.GuildChannelStore.getAllGuilds();
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
                    this.clearSyncInterval();
                    doJob();
                    return;
                }
                const streamKey = `call:${channelId}:1`;
                let fn = async () => {
                    while (true) {
                        const res = await this.api.post({
                            url: `/quests/${quest.id}/heartbeat`,
                            body: { stream_key: streamKey, terminal: false }
                        });
                        const progress = res.body.progress?.PLAY_ACTIVITY?.value ?? secondsDone;
                        this.updateUI(progress, secondsNeeded, questName, detailsText, this.completedQuests, this.totalQuests);
                        console.log(`[AutoQuest] Progresso (atividade): ${Math.floor(progress)}/${secondsNeeded} (${Math.round((progress/secondsNeeded)*100)}%)`);
                        await new Promise(resolve => setTimeout(resolve, 20 * 1000));
                        if (progress >= secondsNeeded) {
                            await this.api.post({
                                url: `/quests/${quest.id}/heartbeat`,
                                body: { stream_key: streamKey, terminal: true }
                            });
                            break;
                        }
                    }
                    console.log(`[AutoQuest] Missão "${questName}" concluída (atividade)!`);
                    this.completedQuests++;
                    this.clearSyncInterval();
                    doJob();
                };
                fn();
            }
        };

        doJob();
    }
};
