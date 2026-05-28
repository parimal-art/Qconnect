import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../lib/api';
import { clearToken, setToken } from '../lib/authStorage';
import { disconnectSocket } from '../lib/socket';

export const login = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', payload);
    setToken(data.accessToken);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Login failed');
  }
});

export const loadMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.user;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Session expired');
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await api.post('/auth/logout'); } catch {}
  clearToken();
  disconnectSocket();
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, isAuthenticated: false, loading: false, error: null },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
    }
  },
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => { state.loading = false; state.user = action.payload.user; state.isAuthenticated = true; })
      .addCase(login.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(loadMe.fulfilled, (state, action) => { state.user = action.payload; state.isAuthenticated = true; })
      .addCase(loadMe.rejected, state => { state.user = null; state.isAuthenticated = false; })
      .addCase(logout.fulfilled, state => { state.user = null; state.isAuthenticated = false; });
  }
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;
