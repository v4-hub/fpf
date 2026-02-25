import sqlite3
import os
import datetime
import hashlib
import json
import random

# 创建数据库文件
data_dir = 'data'
if not os.path.exists(data_dir):
    os.makedirs(data_dir)

db_filename = os.path.join(data_dir, 'footprint_map.db')

# 如果数据库文件已存在，先删除它
if os.path.exists(db_filename):
    os.remove(db_filename)

# 连接到数据库
conn = sqlite3.connect(db_filename)
cursor = conn.cursor()

# 创建用户表
cursor.execute('''
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    avatar TEXT,
    is_active INTEGER DEFAULT 1,
    role TEXT DEFAULT 'user'
)
''')

# 创建足迹地图表
cursor.execute('''
CREATE TABLE journeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    visibility TEXT DEFAULT 'private',
    cover_image TEXT,
    view_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
''')

# 创建足迹点表
cursor.execute('''
CREATE TABLE journey_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journey_id INTEGER NOT NULL,
    time TEXT,
    exact_date TEXT,
    location TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    content TEXT,
    audio_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_index INTEGER,
    FOREIGN KEY (journey_id) REFERENCES journeys(id)
)
''')

# 创建设置表
cursor.execute('''
CREATE TABLE settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    dark_mode INTEGER DEFAULT 0,
    animation_speed INTEGER DEFAULT 5,
    popup_delay INTEGER DEFAULT 5,
    max_arc_height INTEGER DEFAULT 50,
    default_view TEXT DEFAULT '3d',
    center_latitude REAL DEFAULT 35.0,
    center_longitude REAL DEFAULT 105.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
''')

# 在create_database.py脚本中添加以下代码
cursor.execute('''
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    journey_id INTEGER,
    user_id INTEGER,
    FOREIGN KEY (journey_id) REFERENCES journeys(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
)
''')

# 简单的密码哈希函数（实际应用中应使用更安全的哈希算法）
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# 添加示例用户数据
users = [
    ('张明', 'zhangming@example.com', hash_password('password123'), datetime.datetime.now(), datetime.datetime.now(), datetime.datetime.now(), None, 1, 'user'),
    ('李华', 'lihua@example.com', hash_password('password123'), datetime.datetime.now(), datetime.datetime.now(), datetime.datetime.now(), None, 1, 'user'),
    ('王芳', 'wangfang@example.com', hash_password('password123'), datetime.datetime.now(), datetime.datetime.now(), datetime.datetime.now(), None, 1, 'user'),
    ('赵刚', 'zhaogang@example.com', hash_password('password123'), datetime.datetime.now(), datetime.datetime.now(), datetime.datetime.now(), None, 1, 'admin')
]

cursor.executemany('''
INSERT INTO users (username, email, password_hash, created_at, updated_at, last_login, avatar, is_active, role)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
''', users)

# 添加示例足迹地图
journeys = [
    (1, '我的学术之旅', '记录了我多年来的学术足迹与研究历程', datetime.datetime.now(), datetime.datetime.now(), 'public', None, 120),
    (1, '毕业旅行记录', '大学毕业后的环华自驾游', datetime.datetime.now(), datetime.datetime.now(), 'private', None, 45),
    (2, '李华的环球旅行', '五年内走过30个国家的足迹记录', datetime.datetime.now(), datetime.datetime.now(), 'public', None, 324),
    (3, '我们家的迁徙历史', '三代人从农村到城市再到海外的迁徙历程', datetime.datetime.now(), datetime.datetime.now(), 'unlisted', None, 87),
    (4, '饶宗颐先生生平足迹', '记录了饶宗颐先生的重要人生历程和学术足迹', datetime.datetime.now(), datetime.datetime.now(), 'public', None, 560)
]

cursor.executemany('''
INSERT INTO journeys (user_id, title, description, created_at, updated_at, visibility, cover_image, view_count)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
''', journeys)

# 饶宗颐先生足迹数据 - 基于提供的CSV数据
rao_journey_points = [
    (5, '1917年8月9日', '1917/8/9', '广东潮州', 23.6567, 116.6226, '饶宗颐出生于广东潮安县。', datetime.datetime.now(), datetime.datetime.now(), 1),
    (5, '1938年10月', '1938/10/15', '广东广州', 23.1291, 113.2644, '逼于社会动荡形势，中山大学决定迁校于云南澂江。年尾，先生开始染上疟疾，可是当时并无感觉。', datetime.datetime.now(), datetime.datetime.now(), 2),
    (5, '1938年10月', '1938/10/20', '广东潮州', 23.6567, 116.6226, '广州沦陷，广东通志馆关闭，中山大学前往云南澄江。潮汕地区未落入敌寇之手，返回潮州，到凤凰山对畲族进行调查研究。', datetime.datetime.now(), datetime.datetime.now(), 3),
    (5, '1939年2月', '1939/2/15', '广东梅州', 24.2886, 116.1176, '以广东通志馆纂修资格，经詹安泰推荐，受聘为中山大学研究员。', datetime.datetime.now(), datetime.datetime.now(), 4),
    (5, '1941年', '1941/7/1', '廣西桂林', 25.2790, 110.2882, '抗戰軍興，先生自此流徙西南、西北各地。', datetime.datetime.now(), datetime.datetime.now(), 5),
    (5, '1943年秋', '1943/9/1', '貴州遵義', 27.7139, 106.9298, '抵達遵義浙江大學，講授甲骨文。', datetime.datetime.now(), datetime.datetime.now(), 6),
    (5, '1946年7月', '1946/7/1', '廣東廣州', 23.1291, 113.2644, '抗戰勝利後，先生返廣州。任教於廣東省立文理學院、廣東大學。', datetime.datetime.now(), datetime.datetime.now(), 7),
    (5, '1949年', '1949/10/1', '香港', 22.3193, 114.1694, '移居香港，任教於新亞書院（今香港中文大學前身）。', datetime.datetime.now(), datetime.datetime.now(), 8),
    (5, '1962年', '1962/7/1', '法國巴黎', 48.8566, 2.3522, '赴法，結識法蘭西學院戴密微，開展敦煌學研究。', datetime.datetime.now(), datetime.datetime.now(), 9),
    (5, '1970年', '1970/7/1', '新加坡', 1.3521, 103.8198, '任新加坡大學中文系首任講座教授兼系主任。', datetime.datetime.now(), datetime.datetime.now(), 10),
    (5, '1978年', '1978/10/1', '香港', 22.3193, 114.1694, '返港，任香港中文大學中文系講座教授及系主任。', datetime.datetime.now(), datetime.datetime.now(), 11),
    (5, '2000年', '2000/1/1', '香港', 22.3193, 114.1694, '獲香港特別行政區政府頒授大紫荊勳章。', datetime.datetime.now(), datetime.datetime.now(), 12),
    (5, '2018年2月6日', '2018/2/6', '香港', 22.3193, 114.1694, '饒宗頤先生於香港逝世，享年101歲。', datetime.datetime.now(), datetime.datetime.now(), 13)
]

cursor.executemany('''
INSERT INTO journey_points (journey_id, time, exact_date, location, latitude, longitude, content, audio_url, created_at, updated_at, order_index)
VALUES (?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)
''', rao_journey_points)

# 为其他用户添加一些示例足迹点
# 添加学术之旅足迹点
academic_journey_points = [
    (1, '2010年9月', '2010/9/1', '北京', 39.9042, 116.4074, '进入北京大学攻读博士学位，研究方向为中国古代史。', datetime.datetime.now(), datetime.datetime.now(), 1),
    (1, '2013年6月', '2013/6/15', '西安', 34.3416, 108.9398, '参加在西安举办的"丝绸之路文化交流"国际学术研讨会。', datetime.datetime.now(), datetime.datetime.now(), 2),
    (1, '2014年3月', '2014/3/10', '上海', 31.2304, 121.4737, '在复旦大学进行为期三个月的访问学者研究。', datetime.datetime.now(), datetime.datetime.now(), 3),
    (1, '2015年5月', '2015/5/20', '杭州', 30.2741, 120.1551, '参加在杭州举办的"中国传统文化与现代社会"研讨会。', datetime.datetime.now(), datetime.datetime.now(), 4),
    (1, '2016年9月', '2016/9/5', '纽约', 40.7128, -74.0060, '前往哥伦比亚大学进行一年的博士后研究。', datetime.datetime.now(), datetime.datetime.now(), 5),
    (1, '2017年10月', '2017/10/15', '伦敦', 51.5074, -0.1278, '在大英博物馆查阅中国古代文献资料。', datetime.datetime.now(), datetime.datetime.now(), 6),
    (1, '2018年4月', '2018/4/20', '巴黎', 48.8566, 2.3522, '参加在巴黎举办的"东西方文化交流"国际学术会议。', datetime.datetime.now(), datetime.datetime.now(), 7),
    (1, '2019年7月', '2019/7/1', '成都', 30.5728, 104.0668, '返回国内，在四川大学担任副教授。', datetime.datetime.now(), datetime.datetime.now(), 8),
    (1, '2020年12月', '2020/12/15', '广州', 23.1291, 113.2644, '参加在中山大学举办的"岭南文化研究"学术研讨会。', datetime.datetime.now(), datetime.datetime.now(), 9),
    (1, '2022年3月', '2022/3/20', '南京', 32.0603, 118.7969, '受邀在南京大学进行系列学术讲座。', datetime.datetime.now(), datetime.datetime.now(), 10)
]

cursor.executemany('''
INSERT INTO journey_points (journey_id, time, exact_date, location, latitude, longitude, content, audio_url, created_at, updated_at, order_index)
VALUES (?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)
''', academic_journey_points)

# 添加毕业旅行足迹点
graduation_trip_points = [
    (2, '2018年7月1日', '2018/7/1', '北京', 39.9042, 116.4074, '大学毕业，从北京出发开始环华自驾游。', datetime.datetime.now(), datetime.datetime.now(), 1),
    (2, '2018年7月5日', '2018/7/5', '天津', 39.3434, 117.3616, '游览天津古文化街和意大利风情区。', datetime.datetime.now(), datetime.datetime.now(), 2),
    (2, '2018年7月10日', '2018/7/10', '青岛', 36.0671, 120.3826, '在青岛享受海滩和啤酒。', datetime.datetime.now(), datetime.datetime.now(), 3),
    (2, '2018年7月15日', '2018/7/15', '上海', 31.2304, 121.4737, '游览上海外滩和城隍庙。', datetime.datetime.now(), datetime.datetime.now(), 4),
    (2, '2018年7月20日', '2018/7/20', '杭州', 30.2741, 120.1551, '游览西湖，品尝杭州菜。', datetime.datetime.now(), datetime.datetime.now(), 5),
    (2, '2018年7月25日', '2018/7/25', '黄山', 30.1318, 118.1633, '登黄山，观日出。', datetime.datetime.now(), datetime.datetime.now(), 6),
    (2, '2018年8月1日', '2018/8/1', '武汉', 30.5928, 114.3055, '游览黄鹤楼，品尝热干面。', datetime.datetime.now(), datetime.datetime.now(), 7),
    (2, '2018年8月5日', '2018/8/5', '长沙', 28.2282, 112.9388, '游览岳麓山，品尝湘菜。', datetime.datetime.now(), datetime.datetime.now(), 8),
    (2, '2018年8月10日', '2018/8/10', '广州', 23.1291, 113.2644, '游览陈家祠，品尝广东早茶。', datetime.datetime.now(), datetime.datetime.now(), 9),
    (2, '2018年8月15日', '2018/8/15', '桂林', 25.2736, 110.2907, '游览漓江，欣赏山水风光。', datetime.datetime.now(), datetime.datetime.now(), 10),
    (2, '2018年8月20日', '2018/8/20', '成都', 30.5728, 104.0668, '品尝川菜，游览宽窄巷子。', datetime.datetime.now(), datetime.datetime.now(), 11),
    (2, '2018年8月25日', '2018/8/25', '西安', 34.3416, 108.9398, '参观兵马俑，登城墙。', datetime.datetime.now(), datetime.datetime.now(), 12),
    (2, '2018年9月1日', '2018/9/1', '北京', 39.9042, 116.4074, '回到北京，结束旅行。', datetime.datetime.now(), datetime.datetime.now(), 13)
]

cursor.executemany('''
INSERT INTO journey_points (journey_id, time, exact_date, location, latitude, longitude, content, audio_url, created_at, updated_at, order_index)
VALUES (?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)
''', graduation_trip_points)

# 添加环球旅行足迹点
global_trip_points = [
    (3, '2015年1月', '2015/1/15', '北京', 39.9042, 116.4074, '从北京出发，开始环球之旅。', datetime.datetime.now(), datetime.datetime.now(), 1),
    (3, '2015年2月', '2015/2/10', '东京', 35.6762, 139.6503, '游览东京，体验日本文化。', datetime.datetime.now(), datetime.datetime.now(), 2),
    (3, '2015年3月', '2015/3/5', '首尔', 37.5665, 126.9780, '参观首尔古宫，品尝韩国美食。', datetime.datetime.now(), datetime.datetime.now(), 3),
    (3, '2015年4月', '2015/4/15', '曼谷', 13.7563, 100.5018, '体验泰国水上市场和寺庙文化。', datetime.datetime.now(), datetime.datetime.now(), 4),
    (3, '2015年5月', '2015/5/20', '新德里', 28.6139, 77.2090, '参观泰姬陵，了解印度文化。', datetime.datetime.now(), datetime.datetime.now(), 5),
    (3, '2015年6月', '2015/6/10', '开罗', 30.0444, 31.2357, '参观金字塔，了解古埃及文明。', datetime.datetime.now(), datetime.datetime.now(), 6),
    (3, '2015年7月', '2015/7/5', '伊斯坦布尔', 41.0082, 28.9784, '参观蓝色清真寺，品尝土耳其美食。', datetime.datetime.now(), datetime.datetime.now(), 7),
    (3, '2015年8月', '2015/8/15', '罗马', 41.9028, 12.4964, '参观罗马斗兽场，感受古罗马文化。', datetime.datetime.now(), datetime.datetime.now(), 8),
    (3, '2015年9月', '2015/9/10', '巴黎', 48.8566, 2.3522, '登埃菲尔铁塔，游览卢浮宫。', datetime.datetime.now(), datetime.datetime.now(), 9),
    (3, '2015年10月', '2015/10/5', '伦敦', 51.5074, -0.1278, '参观大英博物馆，体验英国下午茶。', datetime.datetime.now(), datetime.datetime.now(), 10),
    (3, '2015年11月', '2015/11/15', '纽约', 40.7128, -74.0060, '游览自由女神像，感受曼哈顿的繁华。', datetime.datetime.now(), datetime.datetime.now(), 11),
    (3, '2015年12月', '2015/12/10', '洛杉矶', 34.0522, -118.2437, '参观好莱坞，体验美国西海岸生活。', datetime.datetime.now(), datetime.datetime.now(), 12),
    (3, '2016年1月', '2016/1/5', '墨西哥城', 19.4326, -99.1332, '参观特奥蒂瓦坎金字塔，了解玛雅文明。', datetime.datetime.now(), datetime.datetime.now(), 13),
    (3, '2016年2月', '2016/2/15', '里约热内卢', -22.9068, -43.1729, '游览科尔科瓦多山，体验巴西狂欢节。', datetime.datetime.now(), datetime.datetime.now(), 14),
    (3, '2016年3月', '2016/3/10', '布宜诺斯艾利斯', -34.6037, -58.3816, '欣赏探戈表演，品尝阿根廷牛肉。', datetime.datetime.now(), datetime.datetime.now(), 15),
    (3, '2016年4月', '2016/4/5', '开普敦', -33.9249, 18.4241, '登桌山，感受南非自然风光。', datetime.datetime.now(), datetime.datetime.now(), 16),
    (3, '2016年5月', '2016/5/15', '悉尼', -33.8688, 151.2093, '参观悉尼歌剧院，体验澳洲生活。', datetime.datetime.now(), datetime.datetime.now(), 17),
    (3, '2016年6月', '2016/6/10', '奥克兰', -36.8485, 174.7633, '探索新西兰自然风光。', datetime.datetime.now(), datetime.datetime.now(), 18),
    (3, '2016年7月', '2016/7/5', '北京', 39.9042, 116.4074, '回到北京，结束环球之旅。', datetime.datetime.now(), datetime.datetime.now(), 19)
]

cursor.executemany('''
INSERT INTO journey_points (journey_id, time, exact_date, location, latitude, longitude, content, audio_url, created_at, updated_at, order_index)
VALUES (?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)
''', global_trip_points)

# 添加家族迁徙足迹点
family_migration_points = [
    (4, '1950年', '1950/6/15', '四川成都', 30.5728, 104.0668, '王氏家族世代居住在成都郊区的一个小村庄，以务农为生。', datetime.datetime.now(), datetime.datetime.now(), 1),
    (4, '1955年', '1955/8/20', '四川绵阳', 31.4646, 104.6796, '由于农业合作化运动，家族部分成员搬迁到绵阳市郊。', datetime.datetime.now(), datetime.datetime.now(), 2),
    (4, '1962年', '1962/3/10', '重庆', 29.4316, 106.9123, '祖父一家迁往重庆，在钢铁厂工作。', datetime.datetime.now(), datetime.datetime.now(), 3),
    (4, '1968年', '1968/7/5', '贵州贵阳', 26.6470, 106.6302, '父亲响应上山下乡号召，前往贵州农村。', datetime.datetime.now(), datetime.datetime.now(), 4),
    (4, '1978年', '1978/9/1', '湖北武汉', 30.5928, 114.3055, '父亲考入武汉大学，开始高等教育。', datetime.datetime.now(), datetime.datetime.now(), 5),
    (4, '1982年', '1982/7/15', '北京', 39.9042, 116.4074, '父亲大学毕业后，被分配到北京一家国企工作。', datetime.datetime.now(), datetime.datetime.now(), 6),
    (4, '1985年', '1985/10/8', '北京', 39.9042, 116.4074, '我在北京出生。', datetime.datetime.now(), datetime.datetime.now(), 7),
    (4, '1992年', '1992/2/25', '深圳', 22.5431, 114.0579, '父亲响应改革开放号召，全家迁往深圳特区创业。', datetime.datetime.now(), datetime.datetime.now(), 8),
    (4, '2003年', '2003/9/1', '香港', 22.3193, 114.1694, '我前往香港上大学，家族首次有成员在境外生活。', datetime.datetime.now(), datetime.datetime.now(), 9),
    (4, '2007年', '2007/6/30', '美国纽约', 40.7128, -74.0060, '大学毕业后，我前往纽约工作，家族开始有海外发展。', datetime.datetime.now(), datetime.datetime.now(), 10),
    (4, '2010年', '2010/5/15', '美国旧金山', 37.7749, -122.4194, '我在旧金山创业，并逐步帮助家人移民美国。', datetime.datetime.now(), datetime.datetime.now(), 11),
    (4, '2015年', '2015/8/20', '加拿大温哥华', 49.2827, -123.1207, '父母退休后移居温哥华，享受安静生活。', datetime.datetime.now(), datetime.datetime.now(), 12),
    (4, '2020年', '2020/12/25', '多伦多', 43.6532, -79.3832, '我搬到多伦多工作，家族在海外第三代开始出生。', datetime.datetime.now(), datetime.datetime.now(), 13)
]

cursor.executemany('''
INSERT INTO journey_points (journey_id, time, exact_date, location, latitude, longitude, content, audio_url, created_at, updated_at, order_index)
VALUES (?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)
''', family_migration_points)

# 添加用户设置
settings = [
    (1, 0, 5, 5, 50, '3d', 35.0, 105.0, datetime.datetime.now(), datetime.datetime.now()),
    (2, 1, 7, 3, 100, '3d', 35.0, 105.0, datetime.datetime.now(), datetime.datetime.now()),
    (3, 0, 4, 7, 75, '2d', 35.0, 105.0, datetime.datetime.now(), datetime.datetime.now()),
    (4, 1, 6, 4, 60, '3d', 35.0, 105.0, datetime.datetime.now(), datetime.datetime.now())
]

cursor.executemany('''
INSERT INTO settings (user_id, dark_mode, animation_speed, popup_delay, max_arc_height, default_view, center_latitude, center_longitude, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', settings)

# 提交并关闭
conn.commit()
conn.close()

print(f"数据库 {db_filename} 创建成功！")