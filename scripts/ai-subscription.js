// Система подписок на ИИ Minko (без лимитов сообщений — только VIP-статус)

class AISubscriptionService {
    constructor() {
        this.subscription = null;
    }

    async getSubscription(userId) {
        if (!userId) return this._getLocalSubscription();

        if (typeof userIdIsSiteCreator === 'function' && supabaseClient) {
            try {
                if (await userIdIsSiteCreator(userId)) {
                    const perm = {
                        subscription_type: 'unlimited',
                        expires_at: null,
                        user_id: userId,
                        messages_limit: 999999,
                        messages_used: 0
                    };
                    this.subscription = perm;
                    this._syncToLocal(perm);
                    return perm;
                }
            } catch (_) {}
        }

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('ai_subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') {
                    return this._getLocalSubscription();
                }

                if (!data) {
                    const local = this._peekLocalSubscription();
                    if (
                        local &&
                        (local.subscription_type === 'premium' || local.subscription_type === 'unlimited')
                    ) {
                        if (
                            local.subscription_type === 'premium' &&
                            local.expires_at &&
                            new Date(local.expires_at) < new Date()
                        ) {
                            /* истёк — не подменяем БД локалью */
                        } else {
                            this.subscription = { ...local, user_id: userId };
                            return this.subscription;
                        }
                    }
                    this.subscription = null;
                    return null;
                }

                this.subscription = data;
                this._syncToLocal(data);

                if (data && data.subscription_type === 'premium' && data.expires_at) {
                    if (new Date(data.expires_at) < new Date()) {
                        await this._downgradeToFree(userId);
                        data.subscription_type = 'free';
                    }
                }

                return data;
            } catch {
                return this._getLocalSubscription();
            }
        }

        return this._getLocalSubscription();
    }

    /** Только чтение кэша в браузере, без записи дефолта «free» */
    _peekLocalSubscription() {
        try {
            const stored = localStorage.getItem('minko_ai_sub');
            if (stored) return JSON.parse(stored);
        } catch {}
        return null;
    }

    _getLocalSubscription() {
        const peek = this._peekLocalSubscription();
        if (peek) return peek;
        const defaultSub = {
            subscription_type: 'free',
            expires_at: null
        };
        localStorage.setItem('minko_ai_sub', JSON.stringify(defaultSub));
        return defaultSub;
    }

    _syncToLocal(data) {
        if (!data) return;
        try {
            localStorage.setItem('minko_ai_sub', JSON.stringify({
                subscription_type: data.subscription_type,
                expires_at: data.expires_at
            }));
        } catch {}
    }

    async getSubscriptionInfo(userId) {
        void userId;
        return { type: 'free', expiresAt: null, isVip: false };
    }

    /** Платный тариф Minko AI отключён — метод оставлен для совместимости со старыми ссылками */
    async activateVipAI(userId) {
        void userId;
        return null;
    }

    async cancelVipAI(userId) {
        void userId;
        try {
            localStorage.setItem(
                'minko_ai_sub',
                JSON.stringify({ subscription_type: 'free', expires_at: null })
            );
        } catch (_) {}
    }

    async _downgradeToFree(userId) {
        if (userId && typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient
                    .from('ai_subscriptions')
                    .update({
                        subscription_type: 'free',
                        messages_used: 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);
            } catch {}
        }
    }

    /** Выдача / смена типа из панели создателя */
    async updateSubscriptionType(userId, subscriptionType, expiresAtIso = null) {
        if (!userId || typeof supabaseClient === 'undefined' || !supabaseClient) return false;
        try {
            const row = {
                user_id: userId,
                subscription_type: subscriptionType,
                expires_at: expiresAtIso || null,
                messages_limit: 999999,
                updated_at: new Date().toISOString()
            };
            if (subscriptionType === 'free') {
                row.messages_used = 0;
            }
            const { error } = await supabaseClient.from('ai_subscriptions').upsert(row, {
                onConflict: 'user_id'
            });
            if (error) return false;
            this._syncToLocal({ subscription_type: subscriptionType, expires_at: expiresAtIso });
            return true;
        } catch {
            return false;
        }
    }
}

window.aiSubscriptionService = new AISubscriptionService();
