/**
 * Голосовой чат «Смотреть вместе» — WebRTC mesh (P2P) + сигналы в Supabase.
 * Условия на странице: 2–4 участника и у всех has_vip (см. wtVoiceEligible в watch-together.html).
 *
 * Perfect-negotiation упрощённо: при glare «вежливая» сторона (лексикографически больший userId) делает rollback.
 * Треки для нескольких PC клонируются — один MediaStreamTrack нельзя надёжно вешать на несколько соединений.
 */
(function (global) {
    'use strict';

    const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
    const NEGO_DEBOUNCE_MS = 60;
    /** Периодически сдвигаем метку активности комнаты, пока микрофон включён */
    const MIC_ROOM_ACTIVITY_MS = 60 * 1000;

    class WtVoiceManager {
        constructor() {
            this.sessionId = null;
            this.userId = null;
            this.service = null;
            this.pollTimer = null;
            this.lastPollCursor = null;
            /** @type {Set<string>} */
            this.seenSignalIds = new Set();
            /** @type {Map<string, { pc: RTCPeerConnection, makingOffer?: boolean, negoTimer?: ReturnType<typeof setTimeout> }>} */
            this.peers = new Map();
            this.localStream = null;
            this.micOn = false;
            /** @type {Map<string, HTMLAudioElement>} */
            this.remoteAudios = new Map();
            this.outputVolume = 0.5;
            this._pollInFlight = false;
            /** Треки-клоны для mesh (останавливаем при выкл. мика). */
            this._clonedLocalTracks = [];
            /** @type {ReturnType<typeof setInterval> | null} */
            this._micRoomActivityTimer = null;
        }

        _stopMicRoomActivityTimer() {
            if (this._micRoomActivityTimer) {
                clearInterval(this._micRoomActivityTimer);
                this._micRoomActivityTimer = null;
            }
        }

        _startMicRoomActivityTimer() {
            this._stopMicRoomActivityTimer();
            if (!this.service || typeof this.service.bumpSessionRoomActivity !== 'function') return;
            const tick = () => {
                if (this.micOn && this.sessionId) {
                    void this.service.bumpSessionRoomActivity();
                }
            };
            tick();
            this._micRoomActivityTimer = setInterval(tick, MIC_ROOM_ACTIVITY_MS);
        }

        /**
         * @param {{ sessionId: string, userId: string, service: object }} opts
         */
        ensureReady(opts) {
            const sid = String(opts.sessionId);
            const uid = String(opts.userId);
            if (this.sessionId && this.sessionId !== sid) {
                this.stopSession();
            }
            this.sessionId = sid;
            this.userId = uid;
            this.service = opts.service;
            if (!this.lastPollCursor) {
                this.lastPollCursor = new Date(Date.now() - 120000).toISOString();
            }
            this.startPolling();
        }

        stopSession() {
            this._stopMicRoomActivityTimer();
            this.stopPolling();
            this.setMicEnabled(false).catch(() => {});
            this._closeAllPeers();
            this.sessionId = null;
            this.userId = null;
            this.service = null;
            this.lastPollCursor = null;
            this.seenSignalIds.clear();
        }

        startPolling() {
            if (this.pollTimer || typeof supabaseClient === 'undefined' || !supabaseClient) return;
            this.pollTimer = setInterval(() => this._pollTick(), 650);
        }

        stopPolling() {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        }

        handleIneligible() {
            this._stopMicRoomActivityTimer();
            this.stopPolling();
            this.micOn = false;
            this._stopLocalTracksAndClones();
            this._closeAllPeers();
            global.dispatchEvent(new CustomEvent('wtVoiceUiSync'));
        }

        _stopLocalTracksAndClones() {
            if (this.localStream) {
                this.localStream.getTracks().forEach((t) => t.stop());
                this.localStream = null;
            }
            for (const t of this._clonedLocalTracks) {
                try {
                    t.stop();
                } catch (_) {}
            }
            this._clonedLocalTracks = [];
        }

        setOutputVolume(v) {
            this.outputVolume = Math.max(0, Math.min(1, Number(v) || 0));
            for (const el of this.remoteAudios.values()) {
                el.volume = this.outputVolume;
            }
        }

        _getRemoteUserIds() {
            const parts = this.service?.participants || [];
            return parts.map((p) => String(p.user_id)).filter((id) => id !== this.userId);
        }

        _capSeenIds() {
            if (this.seenSignalIds.size < 400) return;
            this.seenSignalIds = new Set([...this.seenSignalIds].slice(-200));
        }

        async _pollTick() {
            if (!this.sessionId || !this.userId || !supabaseClient || this._pollInFlight) return;
            this._pollInFlight = true;
            try {
                let q = supabaseClient
                    .from('watch_together_voice_signals')
                    .select('*')
                    .eq('session_id', this.sessionId)
                    .order('created_at', { ascending: true })
                    .limit(100);
                if (this.lastPollCursor) {
                    q = q.gt('created_at', this.lastPollCursor);
                }
                const { data, error } = await q;
                if (error) {
                    if (error.code !== 'PGRST116') {
                        console.warn('[WtVoice] poll:', error.message || error);
                    }
                    return;
                }
                const rows = data || [];
                for (const row of rows) {
                    if (this.seenSignalIds.has(row.id)) continue;
                    this.seenSignalIds.add(row.id);
                    this._capSeenIds();
                    this.lastPollCursor = row.created_at;
                    await this._dispatchSignal(row);
                }
            } finally {
                this._pollInFlight = false;
            }
        }

        async _dispatchSignal(row) {
            const from = String(row.from_user_id);
            const to = String(row.to_user_id);
            if (to !== this.userId && from !== this.userId) return;

            const type = row.signal_type;
            const payload = row.payload || {};

            if (type === 'mod_mute') {
                if (to === this.userId && from !== this.userId) {
                    await this.setMicEnabled(false);
                    global.dispatchEvent(
                        new CustomEvent('wtVoiceModerationMuted', { detail: { fromUserId: from } })
                    );
                }
                return;
            }

            if (type === 'hangup') {
                if (from !== this.userId) this._removePeer(from);
                return;
            }

            const remote = from === this.userId ? to : from;
            if (remote === this.userId) return;

            try {
                if (type === 'offer') {
                    await this._onOffer(remote, payload.sdp);
                } else if (type === 'answer') {
                    await this._onAnswer(remote, payload.sdp);
                } else if (type === 'candidate' && payload.candidate) {
                    await this._onCandidate(remote, payload.candidate);
                }
            } catch (e) {
                console.warn('[WtVoice] signal', type, e);
            }
        }

        async _sendSignal(signalType, toUserId, payload) {
            if (!supabaseClient || !this.sessionId || !this.userId) return;
            const { error } = await supabaseClient.from('watch_together_voice_signals').insert({
                session_id: this.sessionId,
                from_user_id: this.userId,
                to_user_id: String(toUserId),
                signal_type: signalType,
                payload: payload || {}
            });
            if (error) console.warn('[WtVoice] insert signal:', error.message || error);
        }

        sendModerationMute(targetUserId) {
            return this._sendSignal('mod_mute', String(targetUserId), {});
        }

        _attachRemoteStream(remoteId, stream) {
            let el = this.remoteAudios.get(remoteId);
            if (!el) {
                el = document.createElement('audio');
                el.autoplay = true;
                el.setAttribute('playsinline', 'true');
                el.dataset.remoteVoice = remoteId;
                const host =
                    document.getElementById('wtVoiceRemoteAudios') || document.body;
                host.appendChild(el);
                this.remoteAudios.set(remoteId, el);
            }
            el.srcObject = stream;
            el.volume = this.outputVolume;
            el.play?.().catch(() => {});
        }

        _removePeer(remoteId) {
            const rid = String(remoteId);
            const entry = this.peers.get(rid);
            if (entry?.negoTimer) clearTimeout(entry.negoTimer);
            if (entry?.pc) {
                try {
                    entry.pc.close();
                } catch (_) {}
            }
            this.peers.delete(rid);
            const el = this.remoteAudios.get(rid);
            if (el) {
                el.srcObject = null;
                el.remove();
                this.remoteAudios.delete(rid);
            }
            global.dispatchEvent(
                new CustomEvent('wtVoiceRemoteTrack', { detail: { remoteId: rid, active: false } })
            );
        }

        _closeAllPeers() {
            for (const rid of [...this.peers.keys()]) {
                this._removePeer(rid);
            }
        }

        /**
         * Один и тот же захват с микрофона — отдельный трек на каждое RTCPeerConnection (clone).
         */
        _getLocalAudioTrackForNewSender() {
            if (!this.localStream) return null;
            const [base] = this.localStream.getAudioTracks();
            if (!base) return null;
            const clone = base.clone();
            this._clonedLocalTracks.push(clone);
            return clone;
        }

        _wirePeerNegotiation(rid, pc) {
            const r = String(rid);
            pc.onnegotiationneeded = () => {
                this._scheduleNegotiation(r);
            };
        }

        _scheduleNegotiation(rid) {
            const meta = this.peers.get(rid);
            if (!meta?.pc || !this.sessionId) return;
            if (meta.negoTimer) clearTimeout(meta.negoTimer);
            meta.negoTimer = setTimeout(() => {
                meta.negoTimer = undefined;
                void this._flushNegotiationOffer(rid);
            }, NEGO_DEBOUNCE_MS);
        }

        async _flushNegotiationOffer(rid) {
            const r = String(rid);
            const meta = this.peers.get(r);
            const pc = meta?.pc;
            if (!pc || !this.micOn || !this.sessionId) return;
            if (meta.makingOffer) return;
            if (pc.signalingState !== 'stable') return;
            meta.makingOffer = true;
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await this._sendSignal('offer', r, { sdp: offer.sdp });
            } catch (e) {
                console.warn('[WtVoice] offer', e);
            } finally {
                meta.makingOffer = false;
            }
        }

        async _ensurePeer(remoteId) {
            const rid = String(remoteId);
            if (this.peers.has(rid)) {
                const { pc } = this.peers.get(rid);
                if (this.localStream) {
                    const has = pc.getSenders().some((s) => s.track && s.track.kind === 'audio');
                    if (!has) {
                        const tr = this._getLocalAudioTrackForNewSender();
                        if (tr) {
                            try {
                                pc.addTrack(tr, this.localStream);
                            } catch (e) {
                                console.warn('[WtVoice] addTrack', e);
                            }
                        }
                    }
                }
                return pc;
            }

            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            this.peers.set(rid, { pc, makingOffer: false });

            this._wirePeerNegotiation(rid, pc);

            pc.onicecandidate = (e) => {
                if (e.candidate && this.sessionId) {
                    void this._sendSignal('candidate', rid, { candidate: e.candidate.toJSON() });
                }
            };
            pc.ontrack = (e) => {
                if (e.streams && e.streams[0]) {
                    this._attachRemoteStream(rid, e.streams[0]);
                    global.dispatchEvent(
                        new CustomEvent('wtVoiceRemoteTrack', {
                            detail: { remoteId: rid, active: true }
                        })
                    );
                }
            };

            if (this.localStream) {
                const tr = this._getLocalAudioTrackForNewSender();
                if (tr) {
                    try {
                        pc.addTrack(tr, this.localStream);
                    } catch (e) {
                        console.warn('[WtVoice] addTrack', e);
                    }
                }
            }

            return pc;
        }

        async _onOffer(remote, sdp) {
            if (!sdp) return;
            const rid = String(remote);
            let pc = this.peers.get(rid)?.pc;

            if (pc && pc.signalingState === 'have-local-offer') {
                if (this.userId < rid) {
                    return;
                }
                try {
                    await pc.setLocalDescription({ type: 'rollback' });
                } catch (e) {
                    console.warn('[WtVoice] rollback', e);
                    this._removePeer(rid);
                    await this._onOffer(remote, sdp);
                    return;
                }
            }

            pc = await this._ensurePeer(rid);
            await pc.setRemoteDescription({ type: 'offer', sdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this._sendSignal('answer', rid, { sdp: answer.sdp });
        }

        async _onAnswer(remote, sdp) {
            if (!sdp) return;
            const rid = String(remote);
            const pc = this.peers.get(rid)?.pc;
            if (!pc) return;
            if (pc.signalingState === 'stable') return;
            await pc.setRemoteDescription({ type: 'answer', sdp });
        }

        async _onCandidate(remote, candidateInit) {
            const rid = String(remote);
            const pc = this.peers.get(rid)?.pc;
            if (!pc) return;
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
            } catch (_) {}
        }

        syncParticipants(participants) {
            const ids = new Set(
                (participants || []).map((p) => String(p.user_id)).filter((id) => id !== this.userId)
            );
            for (const id of [...this.peers.keys()]) {
                if (!ids.has(id)) this._removePeer(id);
            }
            if (this.micOn && this.localStream) {
                for (const id of ids) {
                    void this._ensurePeer(id);
                }
            }
        }

        async setMicEnabled(on) {
            if (!on) {
                this._stopMicRoomActivityTimer();
                this.micOn = false;
                for (const { pc } of this.peers.values()) {
                    for (const s of pc.getSenders()) {
                        if (s.track) {
                            try {
                                await s.replaceTrack(null);
                            } catch (_) {}
                        }
                    }
                }
                this._stopLocalTracksAndClones();
                global.dispatchEvent(new CustomEvent('wtVoiceUiSync'));
                return;
            }

            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Браузер не поддерживает микрофон');
            }

            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: false
            });
            this.micOn = true;

            for (const rid of this._getRemoteUserIds()) {
                await this._ensurePeer(rid);
            }

            this._startMicRoomActivityTimer();

            global.dispatchEvent(new CustomEvent('wtVoiceUiSync'));
        }

        isMicOn() {
            return this.micOn;
        }
    }

    global.wtVoiceManager = new WtVoiceManager();
})(typeof window !== 'undefined' ? window : globalThis);
