import { createSlice } from '@reduxjs/toolkit';

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: { items: [], unread: 0 },
  reducers: {
    addNotification(state, action) {
      state.items.unshift(action.payload);
      if (!action.payload.isRead) state.unread += 1;
    },
    setNotifications(state, action) {
      state.items = action.payload || [];
      state.unread = state.items.filter(n => !n.isRead).length;
    },
    markAllRead(state) {
      state.items = state.items.map(n => ({ ...n, isRead: true }));
      state.unread = 0;
    }
  }
});

export const { addNotification, setNotifications, markAllRead } = notificationSlice.actions;
export default notificationSlice.reducer;
