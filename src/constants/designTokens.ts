import rpx from "@/utils/rpx";

/**
 * 统一的视觉设计 token。
 * 间距/圆角/高度等所有界面值应优先从这里取，而不是散落在各个 StyleSheet 里。
 */

/** 间距阶梯：xs < sm < md < lg < xl < xxl */
export const spacing = {
    xs: rpx(8),
    sm: rpx(12),
    md: rpx(16),
    lg: rpx(24),
    xl: rpx(32),
    xxl: rpx(48),
} as const;

/** 圆角阶梯 */
export const radius = {
    small: rpx(8),
    medium: rpx(12),
    large: rpx(24),
    pill: 999,
} as const;

/** 常见组件尺寸 */
export const size = {
    /** 轻量按钮高度 */
    buttonSm: rpx(48),
    /** 普通按钮高度 */
    buttonMd: rpx(64),
    /** 列表项高度（大/常规/小） */
    listItemLarge: rpx(120),
    listItemNormal: rpx(108),
    listItemSmall: rpx(96),
} as const;

export default { spacing, radius, size };
