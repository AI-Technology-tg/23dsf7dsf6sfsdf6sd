const DirectMessagesService = {
    _realtimeChannel: null,
    _currentChatUserId: null,
    _profileCache: {},
    _cachedUserId: null,
    _cachedAccessToken: null,

    async getCurrentUserId() {
        if (this._cachedUserId) return this._cachedUserId;
        if (!supabaseClient) return null;
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            this._cachedUserId = session?.user?.id || null;
            this._cachedAccessToken = session?.access_token || null;
            return this._cachedUserId;
        } catch (e) { return null; }
    },

    async getProfile(userId, forceRefresh) {
        if (forceRefresh) delete this._profileCache[userId];
        if (this._profileCache[userId]) return this._profileCache[userId];
        try {
            let data = null;
            if (typeof reminkoFetchProfilesIn === 'function') {
                const list = await reminkoFetchProfilesIn(supabaseClient, [userId]);
                data = list[0] || null;
            } else {
                let row = await supabaseClient
                    .from('profiles')
                    .select('id, username, avatar, last_online, current_activity, is_site_creator')
                    .eq('id', userId)
                    .maybeSingle();
                if (row.error) {
                    row = await supabaseClient
                        .from('profiles')
                        .select('id, username, avatar, last_online')
                        .eq('id', userId)
                        .maybeSingle();
                }
                data = row.data;
            }
            if (data) {
                let p = { ...data, id: data.id || userId };
                let isCreator =
                    (typeof window.reminkoUserIdIsSiteCreatorSync === 'function' &&
                        window.reminkoUserIdIsSiteCreatorSync(userId)) ||
                    (typeof window.reminkoIsSiteCreatorProfile === 'function' &&
                        window.reminkoIsSiteCreatorProfile(p));
                if (!isCreator && typeof userIdIsSiteCreator === 'function') {
                    try {
                        isCreator = await userIdIsSiteCreator(userId);
                    } catch (_) {
                        /* ignore */
                    }
                }
                if (isCreator) {
                    p = {
                        ...p,
                        is_site_creator: true,
                        isSiteCreator: true,
                        avatar: 'Fons/Creator ava.png'
                    };
                }
                if (typeof window.reminkoProfileForAvatar === 'function') {
                    p = window.reminkoProfileForAvatar(p, userId);
                }
                this._profileCache[userId] = p;
                return p;
            }
            return data;
        } catch (e) { return null; }
    },

    async getConversations() {
        const userId = await this.getCurrentUserId();
        if (!userId) return [];

        try {
            const { data: messages, error } = await supabaseClient
                .from('direct_messages')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (error || !messages) return [];

            const convMap = {};
            for (const msg of messages) {
                const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
                if (!convMap[otherId]) {
                    convMap[otherId] = {
                        userId: otherId,
                        lastMessage: msg,
                        unreadCount: 0
                    };
                }
                if (msg.receiver_id === userId && !msg.read) {
                    convMap[otherId].unreadCount++;
                }
            }

            const conversations = Object.values(convMap);
            for (const conv of conversations) {
                conv.profile = await this.getProfile(conv.userId);
            }
            conversations.sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));
            return conversations;
        } catch (e) { return []; }
    },

    async getMessages(otherUserId, limit = 100) {
        const userId = await this.getCurrentUserId();
        if (!userId) return [];

        try {
            const { data, error } = await supabaseClient
                .from('direct_messages')
                .select('*')
                .or(
                    `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
                )
                .order('created_at', { ascending: true })
                .limit(limit);

            if (error) { console.error('DM getMessages error:', error); return []; }
            return data || [];
        } catch (e) { return []; }
    },

    async sendMessage(receiverId, messageText) {
        const userId = await this.getCurrentUserId();
        if (!userId || !messageText.trim()) return null;

        try {
            const { data, error } = await supabaseClient
                .from('direct_messages')
                .insert({
                    sender_id: userId,
                    receiver_id: receiverId,
                    message: messageText.trim()
                })
                .select()
                .single();

            if (error) { console.error('DM send error:', error); return null; }
            return data;
        } catch (e) { return null; }
    },

    async markAsRead(otherUserId) {
        const userId = await this.getCurrentUserId();
        if (!userId) return;

        try {
            await supabaseClient
                .from('direct_messages')
                .update({ read: true })
                .eq('sender_id', otherUserId)
                .eq('receiver_id', userId)
                .eq('read', false);
        } catch (e) {}
    },

    async getTotalUnread() {
        const userId = await this.getCurrentUserId();
        if (!userId) return 0;

        try {
            const { count, error } = await supabaseClient
                .from('direct_messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', userId)
                .eq('read', false);

            if (error) return 0;
            return typeof count === 'number' ? count : 0;
        } catch (e) { return 0; }
    },

    subscribeToChat(otherUserId, onNewMessage) {
        this.unsubscribeFromChat();
        this._currentChatUserId = otherUserId;

        this._realtimeChannel = supabaseClient
            .channel(`dm-${Date.now()}-${otherUserId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'direct_messages'
            }, (payload) => {
                const msg = payload.new;
                const isRelevant =
                    (msg.sender_id === otherUserId || msg.receiver_id === otherUserId);
                if (isRelevant && onNewMessage) {
                    onNewMessage(msg);
                }
            })
            .subscribe();
    },

    unsubscribeFromChat() {
        if (this._realtimeChannel) {
            supabaseClient.removeChannel(this._realtimeChannel);
            this._realtimeChannel = null;
        }
        this._currentChatUserId = null;
    },

    async updateActivity(activity) {
        const userId = await this.getCurrentUserId();
        if (!userId) return;

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ current_activity: activity, last_online: new Date().toISOString() })
                .eq('id', userId);
            if (error) console.warn('[DM] updateActivity error:', error.message);
        } catch (e) { console.warn('[DM] updateActivity exception:', e); }
    },

    async clearActivity() {
        await this.updateActivity(null);
    },

    resetSessionCache() {
        this._cachedUserId = null;
        this._cachedAccessToken = null;
    }
};

window.DirectMessagesService = DirectMessagesService;

window.addEventListener('beforeunload', () => {
    if (DirectMessagesService._cachedUserId && typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${DirectMessagesService._cachedUserId}`;
            fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${DirectMessagesService._cachedAccessToken || SUPABASE_ANON_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ current_activity: null, last_online: new Date().toISOString() }),
                keepalive: true
            });
        } catch (e) {}
    }
});
