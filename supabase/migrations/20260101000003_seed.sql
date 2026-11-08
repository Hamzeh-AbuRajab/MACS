-- MACS 003: reference data (ranks, departments, roles, permissions, law categories, site settings).

insert into public.ranks (code, name_en, name_ar, category, level, description) values
 ('minister',        'Minister of Defense',        'وزير الدفاع',          'supreme', 1,  'رأس الهرم في وزارة الدفاع والمسؤول الأول عن جميع القرارات العسكرية.'),
 ('deputy_minister', 'Deputy Minister of Defense', 'نائب وزير الدفاع',    'supreme', 2,  'يعاون الوزير وينوب عنه عند غيابه.'),
 ('field_marshal',   'Field Marshal',              'المشير',               'supreme', 3,  'أعلى رتبة قتالية في القيادة العليا.'),
 ('general',         'General',                    'الفريق',               'supreme', 4,  'عضو في القيادة العليا يشرف على الأقسام العسكرية.'),
 ('captain',         'Captain',                    'نقيب',                 'officer', 5,  'ضابط قيادة ميدانية.'),
 ('first_lieutenant','First Lieutenant',           'ملازم أول',            'officer', 6,  'ضابط يقود وحدات صغيرة.'),
 ('lieutenant',      'Lieutenant',                 'ملازم',                'officer', 7,  'ضابط مبتدئ.'),
 ('sergeant_major',  'Sergeant Major',             'رقيب أول',             'nco',     8,  'أعلى رتب ضباط الصف.'),
 ('sergeant',        'Sergeant',                   'رقيب',                 'nco',     9,  'يشرف على مجموعات الأفراد.'),
 ('corporal',        'Corporal',                   'عريف',                 'nco',     10, 'قائد فريق صغير.'),
 ('specialist',      'Specialist',                 'مختص',                 'enlisted',11, 'فرد متخصص في مهمة محددة.'),
 ('pfc',             'Private First Class',        'جندي أول',             'enlisted',12, 'جندي ذو خبرة.'),
 ('private',         'Private',                    'جندي',                 'enlisted',13, 'جندي نظامي.'),
 ('recruit',         'Recruit',                    'مجند',                 'enlisted',14, 'فرد تحت التدريب.');

insert into public.departments (code, name_en, name_ar, description, sort_order) values
 ('army',      'Army',        'القوات البرية',  'القوات البرية المسؤولة عن العمليات الأرضية وحماية المنشآت.', 1),
 ('air_force', 'Air Force',   'القوات الجوية',  'القوات الجوية المسؤولة عن العمليات الجوية والاستطلاع.',     2),
 ('navy',      'Navy',        'القوات البحرية', 'القوات البحرية المسؤولة عن الحدود والعمليات البحرية.',     3),
 ('delta',     'Delta Force', 'قوات دلتا',      'قوات النخبة للعمليات الخاصة.',                              4);

insert into public.roles (code, name_en, name_ar, scope, is_system, description) values
 ('minister',               'Minister of Defense',        'وزير الدفاع',            'global',     true, 'صلاحيات تشغيلية كاملة عدا الإدارة التقنية.'),
 ('deputy_minister',        'Deputy Minister of Defense', 'نائب وزير الدفاع',       'global',     true, 'مثل الوزير دون صلاحيات الحذف والموقع.'),
 ('supreme_command',        'Supreme Command',            'القيادة العليا',         'global',     true, 'عرض التقارير والقرارات والبيانات.'),
 ('field_marshal',          'Field Marshal',              'المشير',                'global',     true, 'عرض بيانات القيادة.'),
 ('general',                'General',                    'الفريق',                'global',     true, 'عرض بيانات القيادة.'),
 ('department_commander',   'Department Commander',       'قائد قسم',              'department', true, 'إدارة أفراد القسم ضمن حدود القسم فقط.'),
 ('officer',                'Officer',                    'ضابط',                  'department', true, 'عرض بيانات القسم.'),
 ('sergeant',               'Sergeant',                   'ضابط صف',               'department', true, 'عرض محدود لبيانات القسم.'),
 ('soldier',                'Soldier',                    'فرد',                   'department', true, 'ملفه الشخصي والقوانين والقرارات وتقديم الطلبات.'),
 ('intelligence_officer',   'Intelligence Officer',       'ضابط استخبارات',        'global',     true, 'البلاغات والقضايا والتحقيقات.'),
 ('warehouse_manager',      'Warehouse Manager',          'مدير مستودعات',         'global',     true, 'المستودعات والعهد.'),
 ('personnel_administrator','Personnel Administrator',    'مسؤول شؤون الأفراد',    'global',     true, 'ملفات العسكريين والترقيات والإجازات.'),
 ('system_administrator',   'System Administrator',       'مدير النظام',           'global',     true, 'الحسابات والصلاحيات والإعدادات التقنية.');

insert into public.permissions (code, resource, action, description)
select r || '.' || a, r, a, r || ' ' || a
from unnest(array['users','roles','ranks','departments','personnel','laws','announcements','decisions',
  'promotions','leaves','discipline','warehouses','inventory','custody','cases','investigations',
  'reports','site','audit']) r
cross join unnest(array['view','create','update','delete','approve']) a;

-- role → permission matrix
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on
 case r.code
  when 'minister' then p.resource not in ('roles','users') or p.code = 'users.view'
  when 'deputy_minister' then (p.resource not in ('roles','users','site','audit') and p.action <> 'delete') or p.code in ('users.view','audit.view')
  when 'supreme_command' then (p.action = 'view' and p.resource not in ('roles','users','audit'))
                              or p.code in ('decisions.create','announcements.create')
  when 'field_marshal' then p.action = 'view' and p.resource in ('personnel','departments','reports','decisions','promotions','leaves','discipline','announcements','laws')
  when 'general' then p.action = 'view' and p.resource in ('personnel','departments','reports','decisions','promotions','leaves','discipline','announcements')
  when 'department_commander' then p.code in ('personnel.view','personnel.update','personnel.approve','promotions.view',
      'leaves.view','leaves.approve','discipline.view','discipline.create','announcements.view','announcements.create',
      'announcements.update','decisions.view','decisions.create','laws.view','reports.view','inventory.view',
      'warehouses.view','custody.view','departments.view')
  when 'officer' then p.code in ('personnel.view','leaves.view','promotions.view','departments.view','reports.view')
  when 'sergeant' then p.code in ('personnel.view','leaves.view')
  when 'soldier' then false
  when 'intelligence_officer' then p.resource in ('cases','investigations') or p.code in ('laws.view','personnel.view','discipline.view')
  when 'warehouse_manager' then p.resource in ('warehouses','inventory','custody')
  when 'personnel_administrator' then p.resource in ('personnel','promotions','leaves','discipline')
      or p.code in ('users.view','users.create','users.update','ranks.view','departments.view','departments.update','reports.view')
  when 'system_administrator' then p.resource in ('users','roles','site','ranks','departments','laws','announcements')
      or p.code in ('audit.view','personnel.view')
  else false end;

insert into public.law_categories (code, name_ar, name_en, sort_order) values
 ('general',       'القوانين العامة لوزارة الدفاع',            'General Regulations',            1),
 ('discipline',    'قوانين الانضباط العسكري',                  'Military Discipline',            2),
 ('ranks',         'قوانين الرتب والترقيات',                   'Ranks & Promotions',             3),
 ('weapons',       'قوانين الأسلحة والمعدات',                  'Weapons & Equipment',            4),
 ('operations',    'قوانين العمليات العسكرية',                 'Military Operations',            5),
 ('departments',   'قوانين الأقسام العسكرية',                  'Department Regulations',         6),
 ('intelligence',  'قوانين الاستخبارات العسكرية',              'Military Intelligence',          7),
 ('warehouses',    'قوانين المستودعات والقواعد العسكرية',      'Warehouses & Bases',             8),
 ('police',        'قوانين التعامل مع الشرطة والجهات الحكومية','Police & Government Relations',  9),
 ('leaves',        'قوانين الإجازات والغياب',                  'Leave & Absence',                10),
 ('corruption',    'قوانين الفساد والخيانة العسكرية',          'Corruption & Treason',           11),
 ('penalties',     'نظام العقوبات العسكرية',                   'Penalty System',                 12),
 ('final',         'الأحكام الختامية',                         'Final Provisions',               13),
 ('army',          'قوانين القوات البرية',                     'Army Regulations',               14),
 ('air_force',     'قوانين القوات الجوية',                     'Air Force Regulations',          15),
 ('navy',          'قوانين القوات البحرية',                    'Navy Regulations',               16),
 ('delta',         'قوانين قوات دلتا',                         'Delta Force Regulations',        17),
 ('recruitment',   'قوانين التجنيد والاحتياط',                 'Recruitment & Reserve',          18),
 ('investment',    'قوانين الاستثمار العسكري',                 'Military Investment',            19);

insert into public.site_settings (key, value) values
 ('ministry', jsonb_build_object(
   'name_ar', 'وزارة الدفاع الأمريكية',
   'name_en', 'Department of Defense',
   'system_name', 'MACS',
   'system_name_ar', 'نظام الإدارة والقيادة العسكرية',
   'tagline', 'الانضباط · الولاء · الواجب',
   'about', 'وزارة الدفاع هي الجهة العليا المسؤولة عن إدارة القوات المسلحة وتنظيم أقسامها ورتبها وعملياتها داخل السيرفر، وتضمن الانضباط والتسلسل القيادي عبر نظام MACS.',
   'logo_url', null));

insert into public.warehouses (code, name_ar, name_en, kind, department_id) values
 ('main',      'المستودع الرئيسي',        'Main Warehouse',    'main',      null),
 ('weapons',   'مستودع الأسلحة',          'Weapons Depot',     'weapons',   null),
 ('ammo',      'مستودع الذخائر',          'Ammunition Depot',  'ammo',      null),
 ('equipment', 'مستودع المعدات',          'Equipment Depot',   'equipment', null),
 ('vehicles',  'مستودع المركبات',         'Vehicle Depot',     'vehicles',  null);
insert into public.warehouses (code, name_ar, name_en, kind, department_id)
select 'dept_' || code, 'مستودع ' || name_ar, name_en || ' Depot', 'department', id from public.departments;
