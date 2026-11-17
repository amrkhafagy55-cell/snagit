-- SNAGIT — default checklist templates (English + Arabic)
-- Copied into each room when it is created. Admins can edit; users add custom items per room.

insert into public.checklist_templates (room_type, category, title_en, title_ar, sort_order)
select v.room_type::public.room_type, v.category, v.title_en, v.title_ar, v.sort_order
from (values
  -- Entrance ---------------------------------------------------------------
  ('entrance','architectural','Main door alignment and operation','استواء الباب الرئيسي وسهولة فتحه وغلقه',10),
  ('entrance','architectural','Door lock, hinges and hardware','كالون الباب والمفصلات والإكسسوارات',20),
  ('entrance','architectural','Wall cracks','شروخ الحوائط',30),
  ('entrance','architectural','Paint defects','عيوب الدهانات',40),
  ('entrance','architectural','Floor tile level and joints','استواء البلاط وانتظام العراميس',50),
  ('entrance','architectural','Hollow tiles (tap test)','بلاط مطبل (اختبار الطرق)',60),
  ('entrance','architectural','Ceiling defects','عيوب السقف',70),
  ('entrance','electrical','Lighting points','مخارج الإنارة',110),
  ('entrance','electrical','Switches','المفاتيح',120),
  ('entrance','electrical','Doorbell / intercom','الجرس / الإنتركم',130),
  ('entrance','electrical','Distribution board and breakers labelling','لوحة التوزيع وترقيم القواطع',140),
  ('entrance','electrical','Earthing','التأريض',150),

  -- Reception / living ---------------------------------------------------
  ('living','architectural','Wall cracks','شروخ الحوائط',10),
  ('living','architectural','Paint defects','عيوب الدهانات',20),
  ('living','architectural','Plaster irregularities','عدم استواء المحارة',30),
  ('living','architectural','Floor tile defects','عيوب البلاط',40),
  ('living','architectural','Hollow tiles (tap test)','بلاط مطبل (اختبار الطرق)',50),
  ('living','architectural','Skirting','الوزرة',60),
  ('living','architectural','Window installation and sealing','تركيب الشبابيك والعزل حولها',70),
  ('living','architectural','Glass and window hardware','الزجاج وإكسسوارات الشبابيك',80),
  ('living','architectural','Ceiling defects','عيوب السقف',90),
  ('living','electrical','Lighting points','مخارج الإنارة',110),
  ('living','electrical','Switches','المفاتيح',120),
  ('living','electrical','Power sockets','البرايز',130),
  ('living','electrical','TV / data outlets','مخارج التليفزيون والإنترنت',140),
  ('living','mechanical','Air conditioning installation','تركيب التكييف',210),
  ('living','mechanical','AC condensate drainage connection','صرف مياه التكييف',220),
  ('living','mechanical','Equipment operation','تشغيل المعدات',230),

  -- Bedroom --------------------------------------------------------------
  ('bedroom','architectural','Wall cracks','شروخ الحوائط',10),
  ('bedroom','architectural','Paint defects','عيوب الدهانات',20),
  ('bedroom','architectural','Plaster irregularities','عدم استواء المحارة',30),
  ('bedroom','architectural','Floor tile defects','عيوب البلاط',40),
  ('bedroom','architectural','Hollow tiles (tap test)','بلاط مطبل (اختبار الطرق)',50),
  ('bedroom','architectural','Door alignment','استواء الباب',60),
  ('bedroom','architectural','Window installation and sealing','تركيب الشبابيك والعزل حولها',70),
  ('bedroom','architectural','Ceiling defects','عيوب السقف',80),
  ('bedroom','electrical','Lighting points','مخارج الإنارة',110),
  ('bedroom','electrical','Switches','المفاتيح',120),
  ('bedroom','electrical','Power sockets','البرايز',130),
  ('bedroom','mechanical','Air conditioning installation','تركيب التكييف',210),
  ('bedroom','mechanical','AC condensate drainage connection','صرف مياه التكييف',220),

  -- Kitchen --------------------------------------------------------------
  ('kitchen','architectural','Wall tiles','سيراميك الحوائط',10),
  ('kitchen','architectural','Floor tile defects','عيوب البلاط',20),
  ('kitchen','architectural','Hollow tiles (tap test)','بلاط مطبل (اختبار الطرق)',30),
  ('kitchen','architectural','Door alignment','استواء الباب',40),
  ('kitchen','architectural','Window installation','تركيب الشباك',50),
  ('kitchen','architectural','Ceiling defects','عيوب السقف',60),
  ('kitchen','electrical','Lighting points','مخارج الإنارة',110),
  ('kitchen','electrical','Countertop power sockets','برايز سطح المطبخ',120),
  ('kitchen','electrical','Appliance points (cooker, hood, fridge)','مخارج الأجهزة (بوتاجاز، شفاط، ثلاجة)',130),
  ('kitchen','plumbing','Sink and mixer','الحوض والخلاط',210),
  ('kitchen','plumbing','Water pressure','ضغط المياه',220),
  ('kitchen','plumbing','Drainage','الصرف',230),
  ('kitchen','plumbing','Water leakage under sink','تسريب مياه أسفل الحوض',240),
  ('kitchen','plumbing','Pipe connections','وصلات المواسير',250),
  ('kitchen','plumbing','Water heater','السخان',260),
  ('kitchen','mechanical','Ventilation / hood exhaust point','التهوية / مخرج الشفاط',310),

  -- Bathroom -------------------------------------------------------------
  ('bathroom','architectural','Wall tiles','سيراميك الحوائط',10),
  ('bathroom','architectural','Floor tiles and slope to drain','بلاط الأرضية وميوله ناحية الصفاية',20),
  ('bathroom','architectural','Hollow tiles (tap test)','بلاط مطبل (اختبار الطرق)',30),
  ('bathroom','architectural','Door alignment','استواء الباب',40),
  ('bathroom','architectural','Ceiling defects','عيوب السقف',50),
  ('bathroom','electrical','Lighting points','مخارج الإنارة',110),
  ('bathroom','electrical','Switches','المفاتيح',120),
  ('bathroom','electrical','Sockets with RCD protection','برايز محمية بقاطع تسريب',130),
  ('bathroom','plumbing','WC operation and fixing','تشغيل وتثبيت المرحاض',210),
  ('bathroom','plumbing','Washbasin and mixer','الحوض والخلاط',220),
  ('bathroom','plumbing','Shower / bath mixer','خلاط الدش / البانيو',230),
  ('bathroom','plumbing','Water pressure','ضغط المياه',240),
  ('bathroom','plumbing','Drainage and floor drain','الصرف والصفاية',250),
  ('bathroom','plumbing','Water leakage','تسريب المياه',260),
  ('bathroom','plumbing','Sanitary fixtures sealing','عزل الأدوات الصحية (سيليكون)',270),
  ('bathroom','plumbing','Water heater','السخان',280),
  ('bathroom','mechanical','Ventilation / exhaust fan','التهوية / مروحة الشفط',310),

  -- Balcony --------------------------------------------------------------
  ('balcony','architectural','Floor tiles and slope','بلاط الأرضية والميول',10),
  ('balcony','architectural','Waterproofing / signs of leakage','العزل / علامات التسريب',20),
  ('balcony','architectural','Railing stability and height','ثبات الدرابزين وارتفاعه',30),
  ('balcony','architectural','Wall finish','تشطيب الحوائط',40),
  ('balcony','architectural','Balcony door operation','تشغيل باب البلكونة',50),
  ('balcony','plumbing','Rainwater drain','صرف مياه الأمطار',110),
  ('balcony','electrical','Lighting points','مخارج الإنارة',210),
  ('balcony','electrical','Outdoor socket','بريزة خارجية',220),

  -- Corridor -------------------------------------------------------------
  ('corridor','architectural','Wall cracks','شروخ الحوائط',10),
  ('corridor','architectural','Paint defects','عيوب الدهانات',20),
  ('corridor','architectural','Floor tile defects','عيوب البلاط',30),
  ('corridor','architectural','Hollow tiles (tap test)','بلاط مطبل (اختبار الطرق)',40),
  ('corridor','architectural','Ceiling defects','عيوب السقف',50),
  ('corridor','electrical','Lighting points','مخارج الإنارة',110),
  ('corridor','electrical','Switches (two-way)','المفاتيح (تحويلة)',120),
  ('corridor','electrical','Power sockets','البرايز',130),

  -- Roof / terrace -------------------------------------------------------
  ('roof','architectural','Waterproofing membrane','طبقة العزل المائي',10),
  ('roof','architectural','Roof slopes and drains','ميول السطح والصفايات',20),
  ('roof','architectural','Parapet walls','دروة السطح',30),
  ('roof','architectural','Floor finish','تشطيب الأرضية',40),
  ('roof','plumbing','Water tank connections','وصلات خزانات المياه',110),
  ('roof','mechanical','AC outdoor units mounting','تثبيت الوحدات الخارجية للتكييف',210),
  ('roof','mechanical','Equipment operation','تشغيل المعدات',220),

  -- Other areas ----------------------------------------------------------
  ('other','architectural','Wall cracks','شروخ الحوائط',10),
  ('other','architectural','Paint defects','عيوب الدهانات',20),
  ('other','architectural','Floor tile defects','عيوب البلاط',30),
  ('other','architectural','Ceiling defects','عيوب السقف',40),
  ('other','electrical','Lighting points','مخارج الإنارة',110),
  ('other','electrical','Power sockets','البرايز',120)
) as v(room_type, category, title_en, title_ar, sort_order)
on conflict (room_type, category, title_en) do nothing;
