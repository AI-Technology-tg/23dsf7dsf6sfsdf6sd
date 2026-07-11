// Система ачивок (роли удалены)
class AchievementsService {
    constructor() {
        this.achievements = {};
    }

    // Получить все ачивки пользователя
    async getUserAchievements(userId) {
        if (!userId || !supabaseClient) return [];

        try {
            const { data, error } = await supabaseClient
                .from('user_achievements')
                .select('achievement_type, earned_at')
                .eq('user_id', userId)
                .order('earned_at', { ascending: false });

            if (error) {
                console.error('Ошибка загрузки ачивок:', error);
                return [];
            }

            return (data || []).map(item => ({
                ...this.achievements[item.achievement_type],
                earnedAt: item.earned_at
            }));
        } catch (error) {
            console.error('Ошибка получения ачивок:', error);
            return [];
        }
    }

    // Получить информацию об ачивке по типу
    getAchievementInfo(type) {
        return this.achievements[type] || null;
    }

    // Проверить имеет ли пользователь ачивку
    async hasAchievement(userId, achievementType) {
        if (!userId || !supabaseClient) return false;

        try {
            const { data, error } = await supabaseClient
                .from('user_achievements')
                .select('id')
                .eq('user_id', userId)
                .eq('achievement_type', achievementType)
                .single();

            return !error && data !== null;
        } catch (error) {
            return false;
        }
    }
}

const achievementsService = new AchievementsService();
window.achievementsService = achievementsService;

