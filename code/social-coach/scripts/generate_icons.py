"""
线条小狗风格 SVG 图标生成器
特征：圆润线条、流畅曲线、一笔画感、可爱比例
"""
import os, math

OUT = os.path.join(os.path.dirname(__file__), '..', 'images')
os.makedirs(OUT, exist_ok=True)

STROKE = '#4A4A4A'
SW = '2.5'  # 统一线宽
FILL_WARM = '#EDDBA8'
FILL_RED = '#DC4A2D'
FILL_CREAM = '#FDFBF7'
ROUND = 'stroke-linecap="round" stroke-linejoin="round"'

def svg(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n{body}\n</svg>'

def save(name, content):
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(content)
    print(f"  ✓ {name}")

# ═══════════════════════════════════════════
# Hero 场景插画 — 简约线条场景
# ═══════════════════════════════════════════

def hero_dinner():
    """职场聚餐 — 圆桌围坐"""
    body = f'''
  <rect width="750" height="900" fill="{FILL_CREAM}"/>
  <!-- 大圆桌 -->
  <ellipse cx="375" cy="500" rx="220" ry="90" fill="none" stroke="{STROKE}" stroke-width="3" {ROUND}/>
  <ellipse cx="375" cy="495" rx="200" ry="80" fill="{FILL_WARM}" opacity="0.3"/>
  <!-- 桌上盘子 -->
  <ellipse cx="270" cy="480" rx="32" ry="16" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <ellipse cx="480" cy="480" rx="32" ry="16" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <ellipse cx="375" cy="450" rx="28" ry="14" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <!-- 酒杯 -->
  <line x1="250" y1="465" x2="250" y2="430" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M232 425 Q250 405 268 425" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="460" y1="465" x2="460" y2="430" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M442 425 Q460 405 478 425" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 围坐小人 -->
  <!-- 上方 -->
  <circle cx="375" cy="280" r="32" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M343 320 Q375 340 407 320" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 左上 -->
  <circle cx="190" cy="340" r="28" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M162 375 Q190 392 218 375" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 右上 -->
  <circle cx="560" cy="340" r="28" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M532 375 Q560 392 588 375" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 左下 -->
  <circle cx="130" cy="450" r="24" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M106 480 Q130 495 154 480" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 右下 -->
  <circle cx="620" cy="450" r="24" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M596 480 Q620 495 644 480" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 敬酒手势 -->
  <circle cx="375" cy="370" r="20" fill="{FILL_WARM}" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <text x="375" y="850" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="36" fill="{STROKE}" font-weight="700">职场如局，杯中有度</text>
'''
    save('hero-dinner.svg', svg(750, 900, body))

def hero_family():
    """家庭聚会 — 沙发聊天"""
    body = f'''
  <rect width="750" height="900" fill="{FILL_CREAM}"/>
  <!-- 长沙发弧线 -->
  <path d="M80 460 Q375 420 670 460" fill="none" stroke="{STROKE}" stroke-width="3.5" {ROUND}/>
  <path d="M80 460 Q375 500 670 460" fill="none" stroke="{STROKE}" stroke-width="3.5" {ROUND}/>
  <path d="M120 450 Q375 490 630 450" fill="{FILL_WARM}" opacity="0.25" stroke="none"/>
  <!-- 沙发扶手 -->
  <path d="M70 450 L70 540" stroke="{STROKE}" stroke-width="3" {ROUND}/>
  <path d="M680 450 L680 540" stroke="{STROKE}" stroke-width="3" {ROUND}/>
  <!-- 茶几 -->
  <rect x="250" y="560" width="250" height="55" rx="12" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 茶杯 -->
  <ellipse cx="340" cy="548" rx="20" ry="10" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <path d="M355 540 Q362 533 358 528" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <ellipse cx="410" cy="546" rx="20" ry="10" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <path d="M395 538 Q388 531 392 526" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <!-- 坐着的人 -->
  <circle cx="180" cy="320" r="30" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M150 355 Q180 420 150 440" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <circle cx="375" cy="290" r="30" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M345 325 Q375 390 345 430" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <circle cx="570" cy="320" r="28" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M542 355 Q570 410 600 440" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 墙上画框 -->
  <rect x="280" y="100" width="190" height="130" rx="6" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <path d="M310 180 Q330 140 380 120 Q420 150 440 180" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <text x="375" y="850" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="36" fill="{STROKE}" font-weight="700">家和万事兴，礼到心也到</text>
'''
    save('hero-family.svg', svg(750, 900, body))

def hero_borrow():
    """拒绝借钱 — 两人对坐"""
    body = f'''
  <rect width="750" height="900" fill="{FILL_CREAM}"/>
  <!-- 桌子 -->
  <rect x="160" y="440" width="430" height="100" rx="14" fill="none" stroke="{STROKE}" stroke-width="3" {ROUND}/>
  <!-- 左边人 -->
  <circle cx="280" cy="250" r="34" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M246 290 Q280 420 246 460" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 右边人 -->
  <circle cx="470" cy="250" r="34" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M436 290 Q470 420 504 460" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 右边→左边的对话框 -->
  <path d="M420 170 Q500 170 500 130 L500 100 Q500 60 420 60 L160 60 Q80 60 80 100 L80 140" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <text x="290" y="100" text-anchor="middle" font-size="26" fill="{STROKE}" font-family="PingFang SC,sans-serif">"兄弟，借点钱..."</text>
  <!-- 左边的拒绝手势 ✋ -->
  <circle cx="260" cy="310" r="24" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="245" y1="295" x2="275" y2="325" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="275" y1="295" x2="245" y2="325" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 桌上硬币 -->
  <circle cx="400" cy="500" r="14" fill="{FILL_WARM}" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <text x="400" y="506" text-anchor="middle" font-size="14" fill="{STROKE}" font-weight="700">¥</text>
  <circle cx="440" cy="505" r="10" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <text x="375" y="850" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="36" fill="{STROKE}" font-weight="700">拒绝是边界，不是冷漠</text>
'''
    save('hero-borrow.svg', svg(750, 900, body))

def hero_report():
    """职场汇报 — 白板演示"""
    body = f'''
  <rect width="750" height="900" fill="{FILL_CREAM}"/>
  <!-- 白板 -->
  <rect x="130" y="80" width="490" height="320" rx="10" fill="none" stroke="{STROKE}" stroke-width="3" {ROUND}/>
  <!-- 白板上的柱状图 -->
  <rect x="180" y="200" width="70" height="150" rx="6" fill="{FILL_WARM}" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <rect x="280" y="240" width="70" height="110" rx="6" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <rect x="380" y="170" width="70" height="180" rx="6" fill="{FILL_WARM}" opacity="0.7" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <rect x="480" y="270" width="70" height="80" rx="6" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <!-- 趋势线 -->
  <path d="M215 340 Q330 380 415 310 Q500 250 545 320" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <circle cx="545" cy="320" r="7" fill="{FILL_RED}" stroke="{STROKE}" stroke-width="1.5"/>
  <!-- 白板支架 -->
  <line x1="300" y1="400" x2="280" y2="520" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="450" y1="400" x2="470" y2="520" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 汇报人 -->
  <circle cx="375" cy="600" r="30" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M345 635 Q375 660 405 635" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M375 635 L375 710" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M330 680 Q375 695 420 680" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <!-- 激光笔 -->
  <line x1="420" y1="580" x2="510" y2="400" stroke="{STROKE}" stroke-width="1.5" stroke-dasharray="6,4" {ROUND}/>
  <circle cx="510" cy="400" r="5" fill="{FILL_RED}" stroke="none"/>
  <text x="375" y="850" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="36" fill="{STROKE}" font-weight="700">汇报不是表演，是沟通</text>
'''
    save('hero-report.svg', svg(750, 900, body))

# ═══════════════════════════════════════════
# 知识库配图 — 120x120 线条小狗风格
# ═══════════════════════════════════════════

def kb(name, body):
    save(f'kb-{name}.svg', svg(120, 120, body))

# 1. 份子钱 — 红包
kb('hongbao', f'''
  <rect x="20" y="30" width="80" height="85" rx="8" fill="{FILL_RED}" opacity="0.12" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <rect x="28" y="36" width="64" height="72" rx="5" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <circle cx="60" cy="44" r="4" fill="{FILL_WARM}" stroke="{STROKE}" stroke-width="1.5"/>
  <text x="60" y="82" text-anchor="middle" font-size="28" fill="{STROKE}" font-weight="700">喜</text>
''')

# 2. 敬酒 — 高脚杯
kb('wine', f'''
  <line x1="60" y1="30" x2="60" y2="55" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <ellipse cx="60" cy="65" rx="28" ry="8" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M38 65 Q60 30 82 65" fill="{FILL_WARM}" opacity="0.4" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="46" y1="72" x2="46" y2="88" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <line x1="74" y1="72" x2="74" y2="88" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <ellipse cx="60" cy="90" rx="18" ry="4" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <!-- 小气泡 -->
  <circle cx="50" cy="52" r="3" fill="none" stroke="{STROKE}" stroke-width="1.5"/>
  <circle cx="66" cy="46" r="2" fill="none" stroke="{STROKE}" stroke-width="1.5"/>
''')

# 3. 见家长 — 礼物盒
kb('gift', f'''
  <rect x="24" y="42" width="72" height="58" rx="6" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="60" y1="42" x2="60" y2="100" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M38 42 Q60 20 82 42" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M32 24 Q60 38 88 24" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <circle cx="60" cy="20" r="5" fill="{FILL_RED}" stroke="{STROKE}" stroke-width="1.5"/>
  <!-- 蝴蝶结 -->
  <path d="M50 42 Q40 36 36 42" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <path d="M70 42 Q80 36 84 42" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
''')

# 4. 节日问候 — 灯笼
kb('festival', f'''
  <ellipse cx="60" cy="58" rx="28" ry="34" fill="{FILL_WARM}" opacity="0.5" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="42" y1="48" x2="78" y2="48" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <line x1="42" y1="60" x2="78" y2="60" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <line x1="42" y1="72" x2="78" y2="72" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <rect x="56" y="18" width="8" height="10" rx="3" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <line x1="60" y1="12" x2="60" y2="18" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <line x1="52" y1="102" x2="68" y2="102" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <path d="M56 94 L60 102 L64 94" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
''')

# 5. 入职 — 门+小人
kb('onboard', f'''
  <rect x="18" y="18" width="84" height="95" rx="8" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="60" y1="18" x2="60" y2="113" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <circle cx="70" cy="60" r="5" fill="none" stroke="{STROKE}" stroke-width="1.5"/>
  <!-- 小人走进门 -->
  <circle cx="36" cy="65" r="9" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <path d="M27 78 Q36 72 45 78" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <path d="M36 78 L36 100" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <path d="M28 88 L44 88" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
''')

# 6. 邮件 — 信封
kb('email', f'''
  <rect x="18" y="38" width="84" height="56" rx="6" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M22 42 L60 68 L98 42" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <circle cx="60" cy="68" r="3" fill="{FILL_RED}" stroke="none"/>
  <line x1="38" y1="55" x2="82" y2="55" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.5"/>
  <line x1="38" y1="65" x2="72" y2="65" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.5"/>
  <line x1="38" y1="75" x2="75" y2="75" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.5"/>
''')

# 7. 面试 — 文档+笔
kb('interview', f'''
  <rect x="28" y="14" width="64" height="90" rx="5" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="38" y1="30" x2="82" y2="30" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <line x1="38" y1="44" x2="82" y2="44" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.5"/>
  <line x1="38" y1="54" x2="68" y2="54" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.5"/>
  <rect x="38" y="64" width="38" height="22" rx="4" fill="{FILL_WARM}" opacity="0.7" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <text x="57" y="80" text-anchor="middle" font-size="12" fill="{STROKE}" font-weight="600">CV</text>
  <!-- 笔 -->
  <line x1="82" y1="38" x2="95" y2="20" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <polygon points="95,20 98,14 92,16" fill="{STROKE}" stroke="none"/>
''')

# 8. 拒绝 — 盾牌+X
kb('refuse', f'''
  <path d="M60 12 L96 34 L96 68 Q96 98 60 110 Q24 98 24 68 L24 34 Z" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="38" y1="50" x2="82" y2="82" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="82" y1="50" x2="38" y2="82" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
''')

# 9. 道歉 — 双手合十
kb('apology', f'''
  <!-- 合十的双手 -->
  <path d="M32 30 L44 50 L44 90" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M88 30 L76 50 L76 90" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M44 50 Q60 38 76 50" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <!-- 小头 -->
  <circle cx="60" cy="20" r="14" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <!-- 眼睛 -->
  <circle cx="54" cy="17" r="2" fill="{STROKE}"/>
  <circle cx="66" cy="17" r="2" fill="{STROKE}"/>
  <!-- 微笑 -->
  <path d="M52 26 Q60 32 68 26" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
''')

# 10. 群聊阴阳 — 对话泡+?
kb('groupchat', f'''
  <path d="M22 28 Q22 10 60 10 L85 10 Q105 10 105 28 L105 48 Q105 62 92 62 L82 62" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M82 62 L92 76 L74 62" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="38" y1="28" x2="90" y2="28" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <line x1="38" y1="40" x2="80" y2="40" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <text x="60" y="56" text-anchor="middle" font-size="18" fill="{FILL_RED}" font-weight="700">?!</text>
''')

# 11. 微信社交 — 手机屏幕
kb('wechat', f'''
  <rect x="28" y="10" width="64" height="102" rx="10" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <rect x="36" y="18" width="48" height="76" rx="4" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <circle cx="60" cy="26" r="3" fill="{STROKE}"/>
  <!-- 对话框 -->
  <path d="M42 40 Q42 34 54 34 L72 34 Q80 34 80 40 L80 52 Q80 58 72 58 L68 58 L72 64 L64 58 L54 58 Q42 58 42 52 Z" fill="{FILL_WARM}" opacity="0.5" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <circle cx="60" cy="104" r="4" fill="{STROKE}"/>
''')

# 12. 探望 — 花+卡片
kb('visit', f'''
  <!-- 花束 -->
  <line x1="60" y1="55" x2="60" y2="108" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M46 72 Q60 64 74 72" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <!-- 花朵 -->
  <circle cx="60" cy="38" r="16" fill="{FILL_WARM}" opacity="0.6" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <circle cx="47" cy="42" r="10" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <circle cx="73" cy="42" r="10" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <circle cx="60" cy="28" r="10" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <circle cx="51" cy="34" r="3" fill="{FILL_RED}" stroke="none"/>
  <circle cx="69" cy="48" r="3" fill="{FILL_RED}" stroke="none"/>
  <!-- 小卡片 -->
  <rect x="50" y="100" width="20" height="14" rx="2" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
  <text x="60" y="111" text-anchor="middle" font-size="8" fill="{STROKE}">♥</text>
''')

# ═══════════════════════════════════════════
# 导航图标 80x80
# ═══════════════════════════════════════════

def tab(name, body):
    save(f'tab-{name}.svg', svg(80, 80, body))

tab('home', f'''
  <path d="M12 38 L40 12 L68 38" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M22 42 L22 68 L58 68 L58 42" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <rect x="35" y="52" width="10" height="16" rx="2" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
''')

tab('advice', f'''
  <path d="M16 16 Q16 8 28 8 L52 8 Q68 8 68 16 L68 36 Q68 48 54 48 L46 48 L54 60 L40 48 L28 48 Q16 48 16 36 Z" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <circle cx="33" cy="28" r="3" fill="{STROKE}"/>
  <circle cx="46" cy="28" r="3" fill="{STROKE}"/>
  <circle cx="59" cy="28" r="3" fill="{STROKE}"/>
''')

tab('etiquette', f'''
  <line x1="40" y1="14" x2="40" y2="68" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M40 18 Q24 8 16 20 L16 60 Q24 52 40 58" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M40 18 Q56 8 64 20 L64 60 Q56 52 40 58" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="28" y1="30" x2="40" y2="35" stroke="{STROKE}" stroke-width="1.2" {ROUND} opacity="0.35"/>
  <line x1="52" y1="30" x2="40" y2="35" stroke="{STROKE}" stroke-width="1.2" {ROUND} opacity="0.35"/>
''')

tab('profile', f'''
  <circle cx="40" cy="20" r="14" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M16 60 Q16 38 40 38 Q64 38 64 60" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <circle cx="33" cy="17" r="2.5" fill="{STROKE}"/>
  <circle cx="47" cy="17" r="2.5" fill="{STROKE}"/>
  <path d="M34 27 Q40 31 46 27" fill="none" stroke="{STROKE}" stroke-width="1.5" {ROUND}/>
''')

# ═══════════════════════════════════════════
# UI 小图标 48x48
# ═══════════════════════════════════════════

def ui(name, body):
    save(f'ui-{name}.svg', svg(48, 48, body))

ui('search', f'''
  <circle cx="20" cy="20" r="12" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="29" y1="29" x2="42" y2="42" stroke="{STROKE}" stroke-width="3" {ROUND}/>
''')

ui('star', f'''
  <path d="M24 6 L30 20 L45 22 L34 33 L36 47 L24 40 L12 47 L14 33 L3 22 L18 20 Z" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
''')

ui('clock', f'''
  <circle cx="24" cy="24" r="18" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="24" y1="14" x2="24" y2="24" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="24" y1="24" x2="33" y2="28" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <circle cx="24" cy="24" r="2.5" fill="{STROKE}"/>
''')

ui('arrow', f'''
  <path d="M16 24 L32 24" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M26 18 L34 24 L26 30" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
''')

ui('persona', f'''
  <rect x="6" y="8" width="36" height="36" rx="6" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <circle cx="24" cy="22" r="7" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <path d="M12 40 Q12 28 24 28 Q36 28 36 40" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
''')

ui('edit', f'''
  <path d="M34 8 L40 14 L18 37 L10 38 L12 30 Z" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
''')

ui('about', f'''
  <circle cx="24" cy="24" r="18" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <text x="24" y="31" text-anchor="middle" font-size="20" fill="{STROKE}" font-weight="700">?</text>
''')

ui('empty', f'''
  <rect x="8" y="12" width="32" height="30" rx="5" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="16" y1="22" x2="32" y2="22" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <line x1="16" y1="28" x2="28" y2="28" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <line x1="16" y1="34" x2="24" y2="34" stroke="{STROKE}" stroke-width="1.5" {ROUND} opacity="0.4"/>
  <circle cx="36" cy="12" r="2" fill="{FILL_RED}" stroke="none"/>
''')

ui('refresh', f'''
  <path d="M34 10 A18 18 0 1 1 28 12" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <polygon points="32,8 36,16 28,12" fill="{STROKE}" stroke="none"/>
''')

ui('mic', f'''
  <rect x="18" y="6" width="12" height="20" rx="6" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <path d="M12 22 Q24 32 36 22" fill="none" stroke="{STROKE}" stroke-width="{SW}" {ROUND}/>
  <line x1="24" y1="30" x2="24" y2="42" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="14" y1="42" x2="34" y2="42" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
''')

ui('tape', f'''
  <rect x="6" y="4" width="36" height="16" rx="2" fill="{FILL_CREAM}" opacity="0.6" stroke="{STROKE}" stroke-width="1.5" stroke-dasharray="3,2" {ROUND}/>
  <line x1="10" y1="12" x2="36" y2="11" stroke="{STROKE}" stroke-width="1" {ROUND} opacity="0.25"/>
''')

# ═══════════════════════════════════════════
# 策略图标 40x40
# ═══════════════════════════════════════════

save('strategy-paths.svg', svg(40, 40, f'''
  <circle cx="10" cy="20" r="5" fill="{FILL_WARM}" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <circle cx="30" cy="20" r="5" fill="{FILL_WARM}" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <line x1="15" y1="20" x2="25" y2="20" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <polygon points="25,15 32,20 25,25" fill="{STROKE}"/>
'''))

save('strategy-rhythm.svg', svg(40, 40, f'''
  <circle cx="20" cy="20" r="16" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="20" y1="10" x2="20" y2="20" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="20" y1="20" x2="28" y2="26" stroke="{STROKE}" stroke-width="2" {ROUND}/>
  <circle cx="20" cy="20" r="2.5" fill="{FILL_RED}"/>
'''))

save('strategy-counter.svg', svg(40, 40, f'''
  <line x1="10" y1="10" x2="30" y2="30" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <line x1="30" y1="10" x2="10" y2="30" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <circle cx="20" cy="20" r="18" fill="none" stroke="{STROKE}" stroke-width="2" {ROUND}/>
'''))

save('strategy-risk.svg', svg(40, 40, f'''
  <path d="M20 4 L36 34 L4 34 Z" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <text x="20" y="28" text-anchor="middle" font-size="18" fill="{STROKE}" font-weight="700">!</text>
'''))

save('strategy-note.svg', svg(40, 40, f'''
  <circle cx="20" cy="14" r="8" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <path d="M10 30 Q20 38 30 30" fill="none" stroke="{STROKE}" stroke-width="2.5" {ROUND}/>
  <circle cx="20" cy="12" r="2.5" fill="{FILL_RED}"/>
'''))

if __name__ == '__main__':
    print("=== Hero illustrations ===")
    hero_dinner()
    hero_family()
    hero_borrow()
    hero_report()
    print(f"\n✅ All SVGs regenerated in {OUT}")
