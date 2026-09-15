insert into portal_permissions (role, module, can_view, can_edit, can_delete)
values
  ('assistant', 'lat_slip', false, false, false),
  ('coordinator', 'lat_slip', false, false, false),
  ('hod', 'lat_slip', false, false, false),
  ('finance_manager', 'lat_slip', false, false, false)
on conflict (role, module) do nothing;