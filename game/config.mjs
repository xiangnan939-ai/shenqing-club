export const GAMEPLAY_CONFIG = Object.freeze({
  version: 'reference_2026_08',
  canvas: { width: 1080, height: 1920 },
  meta: {
    initialCoins: 1200,
    maxEnergy: 30,
    initialEnergy: 30,
    battleEnergyCost: 1,
    energyRegenSeconds: 600,
  },
  battle: {
    tickMs: 100,
    maxUnitLevel: 5,
    maxGeneralLevel: 5,
    reserveSlots: 5,
    activeItemSlots: 2,
    passiveItemSlots: 6,
    initialAdouHp: 3,
    initialBuns: 42,
    initialUnlockedCells: 8,
    boardSize: 15,
    waveSeconds: 14,
    interWaveSeconds: 1.8,
    waveHpGrowth: 1.115,
    generalExpCurve: [0, 16, 38, 72, 120],
  },
  recruitment: {
    baseWeights: { sword: 21.2, bow: 19.2, spear: 18.2, cavalry: 17.2, farmer: 5.2 },
    generalChance: 13.1,
    generalCharacterCopies: 3,
    costCurve: [16, 16, 20, 24, 28, 32, 40, 48, 56],
  },
  economy: {
    openLandCosts: [28, 38, 50, 64, 80, 98, 120],
    recycleRatio: 0.42,
    farmerIntervalSeconds: 5,
    farmerBunsPerLevel: 1,
  },
  result: {
    winCoins: 120,
    loseCoins: 45,
    coinsPerClearedWave: 8,
    winStars: 1,
    loseStars: -1,
  },
  ai: {
    thinkIntervalSeconds: 0.7,
    recruitResourceMultiplier: 1.03,
    mergeChance: 0.92,
    openLandThreshold: 1,
  },
});

export const SOLDIERS = Object.freeze({
  sword: { id: 'sword', char: '刀', label: '刀兵', attack: 7, pattern: '近战单体', role: '前排' },
  spear: { id: 'spear', char: '枪', label: '枪兵', attack: 9, pattern: '直线穿刺', role: '中排' },
  cavalry: { id: 'cavalry', char: '骑', label: '骑兵', attack: 8, pattern: '小范围群攻', role: '前排' },
  bow: { id: 'bow', char: '弓', label: '弓兵', attack: 10, pattern: '远程投射', role: '后排' },
  farmer: { id: 'farmer', char: '农', label: '农民', attack: 0, pattern: '周期产出馒头', role: '经济' },
});

export const GENERALS = Object.freeze([
  { id: 'general_zhaoyun', name: '赵云', chars: ['赵', '云'], classId: 'spear', attack: 46, skill: '七进七出', description: '直线突进并贯穿多名敌军。' },
  { id: 'general_guanyu', name: '关羽', chars: ['关', '羽'], classId: 'sword', attack: 43, skill: '青龙斩', description: '高伤跳劈并击退目标。' },
  { id: 'general_zhangfei', name: '张飞', chars: ['张', '飞'], classId: 'sword', attack: 41, skill: '当阳大喝', description: '范围震慑，短暂眩晕敌军。' },
  { id: 'general_liubei', name: '刘备', chars: ['刘', '备'], classId: 'sword', attack: 36, skill: '仁德', description: '范围控制并提高友军韧性。' },
  { id: 'general_huangzhong', name: '黄忠', chars: ['黄', '忠'], classId: 'bow', attack: 45, skill: '百步穿杨', description: '向全场目标发动箭雨。' },
  { id: 'general_machao', name: '马超', chars: ['马', '超'], classId: 'spear', attack: 42, skill: '铁骑突阵', description: '中程突刺并概率控制。' },
  { id: 'general_guanping', name: '关平', chars: ['关', '平'], classId: 'sword', attack: 34, skill: '协守', description: '群体控制型前排。' },
  { id: 'general_guanxing', name: '关兴', chars: ['关', '兴'], classId: 'sword', attack: 35, skill: '承志', description: '斩击并概率造成小范围控制。' },
  { id: 'general_zhangbao', name: '张苞', chars: ['张', '苞'], classId: 'spear', attack: 36, skill: '蛇矛贯阵', description: '穿透攻击并概率眩晕。' },
  { id: 'general_zhangyi', name: '张翼', chars: ['张', '翼'], classId: 'sword', attack: 34, skill: '飞袭', description: '跳劈目标并造成击退。' },
  { id: 'general_huangzu', name: '黄祖', chars: ['黄', '祖'], classId: 'bow', attack: 35, skill: '连弩', description: '持续远程箭雨。' },
  { id: 'general_huanggai', name: '黄盖', chars: ['黄', '盖'], classId: 'sword', attack: 38, skill: '苦肉烈火', description: '对周围敌军造成范围伤害。' },
]);

export const ITEMS = Object.freeze([
  { id: 'item_shenbing', name: '神兵符', type: 'active', quality: 'epic', price: 220, effectId: 'upgrade_unit', description: '使一个未满级单位提升一级。' },
  { id: 'item_training', name: '练兵符', type: 'active', quality: 'epic', price: 180, effectId: 'train_unit', description: '目标单位随机升一级或降一级。' },
  { id: 'item_mine', name: '地雷', type: 'active', quality: 'rare', price: 150, effectId: 'damage_wave', description: '立即削减当前来袭敌军生命。' },
  { id: 'item_haste', name: '全体攻速符', type: 'active', quality: 'rare', price: 190, effectId: 'team_haste', description: '本局永久提高全军攻击速度。' },
  { id: 'item_brush', name: '毛笔', type: 'active', quality: 'epic', price: 210, effectId: 'reroll_character', description: '把一个武将字符改为另一字符。' },
  { id: 'item_farmer', name: '农民契', type: 'passive', quality: 'common', price: 120, effectId: 'farmer_income', description: '开局获得农民并提高周期产出。' },
  { id: 'item_shovel', name: '洛阳铲', type: 'passive', quality: 'rare', price: 160, effectId: 'land_discount', description: '首次扩地免费，此后扩地费用降低。' },
  { id: 'item_recruit', name: '招募令', type: 'passive', quality: 'rare', price: 175, effectId: 'general_chance', description: '提高招募武将字符的概率。' },
  { id: 'item_meteor', name: '陨石', type: 'passive', quality: 'epic', price: 240, effectId: 'last_stand', description: '阿斗将受伤时抵挡一次破阵。' },
  { id: 'item_revive', name: '续命丹', type: 'passive', quality: 'epic', price: 260, effectId: 'extra_life', description: '本局阿斗额外获得一条命。' },
]);

export const WEAPONS = Object.freeze([
  { id: 'weapon_longdan', name: '龙胆亮银枪', quality: 'legendary', classId: 'spear', generalId: 'general_zhaoyun', attackBonus: 0.18, effect: '攻击概率触发全场飞枪。' },
  { id: 'weapon_qinglong', name: '青龙偃月刀', quality: 'legendary', classId: 'sword', generalId: 'general_guanyu', attackBonus: 0.17, effect: '强化斩击与击退。' },
  { id: 'weapon_zhangba', name: '丈八蛇矛', quality: 'legendary', classId: 'spear', generalId: 'general_zhangfei', attackBonus: 0.16, effect: '强化控制并召唤灵蛇。' },
  { id: 'weapon_luori', name: '落日弓', quality: 'epic', classId: 'bow', generalId: 'general_huangzhong', attackBonus: 0.14, effect: '提高射程与远距离伤害。' },
  { id: 'weapon_guding', name: '古锭刀', quality: 'epic', classId: 'sword', generalId: null, attackBonus: 0.11, effect: '通用刀剑增伤。' },
  { id: 'weapon_diangang', name: '点钢枪', quality: 'rare', classId: 'spear', generalId: null, attackBonus: 0.08, effect: '通用枪系增伤。' },
]);

export const RANKS = Object.freeze([
  { id: 'recruit', name: '新兵', starsToAdvance: 3, aiBand: 0 },
  { id: 'soldier', name: '军士', starsToAdvance: 4, aiBand: 1 },
  { id: 'captain', name: '校尉', starsToAdvance: 5, aiBand: 2 },
  { id: 'general', name: '将军', starsToAdvance: 6, aiBand: 3 },
  { id: 'marshal', name: '元帅', starsToAdvance: 7, aiBand: 4 },
  { id: 'emperor', name: '皇帝', starsToAdvance: 99, aiBand: 5 },
]);

export const ENEMIES = Object.freeze([
  { id: 'enemy_sword', char: '刀', name: '黄巾刀兵', baseHp: 52, counteredBy: ['cavalry'] },
  { id: 'enemy_cavalry', char: '骑', name: '虎豹骑', baseHp: 68, counteredBy: ['bow'] },
  { id: 'enemy_bow', char: '弓', name: '长弓手', baseHp: 74, counteredBy: ['sword', 'spear'] },
  { id: 'enemy_spear', char: '枪', name: '铁甲枪兵', baseHp: 86, counteredBy: ['cavalry'] },
]);

export const MAPS = Object.freeze([
  { id: 'map_yunmengze', name: '云梦泽', bossWaves: {} },
  { id: 'map_hulaoguan', name: '虎牢关', bossWaves: { 15: '董卓', 20: '吕布' } },
]);

export const QUALITY_LABELS = Object.freeze({
  common: '精良',
  rare: '卓越',
  epic: '史诗',
  legendary: '传说',
});
