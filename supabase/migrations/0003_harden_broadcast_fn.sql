-- Triggerfunktionen ska bara köras av triggern, aldrig anropas via API:t (RPC)
revoke execute on function public.broadcast_events_changes() from public, anon, authenticated;
