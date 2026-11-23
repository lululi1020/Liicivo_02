/**
 * 圣诞树全局配置，统一管理颜色、粒子数量以及默认图片等参数
 */
export const TREE_CONFIG = {
    colors: {
        bg: 0x020b24,       // 深蓝夜空
        fog: 0x071c40,      // 雾蓝
        champagneGold: 0x82d8ff, // 冰蓝银白，沿用旧字段名保持兼容
        deepGreen: 0x164b9b,    // 蓝色礼物
        accentRed: 0xff5f86,    // 草莓粉红点缀
    },
    particles: {
        count: 1500,
        dustCount: 2000,
        snowCount: 1000,
        treeHeight: 24,
        treeRadius: 8,
    },
    performance: {
        responsiveParticles: true,
        smallDeviceWidth: 768,
        particleScale: {
            ornaments: 0.6,
            dust: 0.5,
            snow: 0.7,
        },
    },
    camera: { z: 50 },
    preload: {
        autoScanLocal: true,
        scanCount: 5,
        images: [
            "https://images.unsplash.com/photo-1545048702-79362596cdc9?q=80&w=600",
            "https://images.unsplash.com/photo-1543258103-a62bdc069871?q=80&w=600",
            "https://images.unsplash.com/photo-1480733992048-df39e3947a38?q=80&w=600",
            "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?q=80&w=600",
        ],
    },
} as const;

export type TreeConfig = typeof TREE_CONFIG;
