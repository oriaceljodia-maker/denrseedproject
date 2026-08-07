import { AuthService } from '../../services/auth.service.js';
import { ProfileService } from '../../services/profile.service.js';
import { Router } from '../../router/router.js';
import { ROUTES } from '../../config/constants.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeAttr, escapeHtml } from '../../../utils/formatters.js';

export const ProfilePage = {
  avatarFile: null,

  render() {
    return `
      <div class="profile-page-container">
        <div class="profile-page-heading">
          <span class="eyebrow">Account settings</span>
          <h1>My Profile</h1>
          <p>Update the information shown across your account and choose a profile photo.</p>
        </div>
        <section class="card profile-card">
          <div class="profile-photo-panel">
            <div id="profile-photo-preview" class="profile-photo-preview" aria-label="Profile photo preview"></div>
            <label class="profile-photo-action" for="profile-photo-input">Choose profile photo</label>
            <input id="profile-photo-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
            <p>PNG, JPG, or WebP. Maximum 2 MB.</p>
            <div class="profile-account-info">
              <span>Account information</span>
              <strong id="profile-account-name">Loading...</strong>
              <p id="profile-account-role"></p>
              <p id="profile-account-requests"></p>
            </div>
          </div>
          <form id="profile-form" class="profile-form">
            <div class="form-group">
              <label for="profile-full-name">Full name</label>
              <input id="profile-full-name" class="form-input" type="text" required maxlength="120" />
            </div>
            <div class="form-group">
              <label for="profile-email">Email address</label>
              <input id="profile-email" class="form-input" type="email" readonly />
            </div>
            <div class="form-group">
              <label for="profile-department">Department / Unit</label>
              <input id="profile-department" class="form-input" type="text" maxlength="160" placeholder="e.g., Reforestation Unit" />
            </div>
            <div class="form-group">
              <label for="profile-phone">Phone number</label>
              <input id="profile-phone" class="form-input" type="tel" maxlength="40" placeholder="e.g., +63 9XX XXX XXXX" />
            </div>
            <div class="form-group profile-form-wide">
              <label for="profile-office">Office / Station</label>
              <input id="profile-office" class="form-input" type="text" maxlength="160" placeholder="e.g., DENR Talipan, Pagbilao, Quezon" />
            </div>
            <div class="profile-form-actions">
              <button id="profile-save-button" type="submit" class="btn btn-primary">Save profile</button>
              <button id="profile-cancel-button" type="button" class="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </section>
      </div>`;
  },

  async init() {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      await Router.navigate(null);
      return;
    }

    this.avatarFile = null;
    this.populateProfile(user);
    this.bindEvents(user);
  },

  populateProfile(user) {
    document.getElementById('profile-full-name').value = user.fullName || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-department').value = user.department || '';
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('profile-office').value = user.office || '';
    document.getElementById('profile-account-name').textContent = user.fullName || 'User';
    document.getElementById('profile-account-role').textContent = user.role === 'admin' ? 'Administrator' : 'Field Personnel';
    document.getElementById('profile-account-requests').textContent = user.role === 'admin' ? 'Administrative account' : 'Personnel account';
    this.renderAvatar(user.fullName, user.avatarUrl);
  },

  renderAvatar(fullName, avatarUrl = '') {
    const preview = document.getElementById('profile-photo-preview');
    if (!preview) return;
    const initial = escapeHtml((fullName || 'U').trim().charAt(0).toUpperCase());
    preview.innerHTML = `${avatarUrl ? `<img src="${escapeAttr(avatarUrl)}" alt="Profile photo" />` : ''}<span class="profile-avatar-initial">${initial}</span>`;
  },

  bindEvents(user) {
    const form = document.getElementById('profile-form');
    const photoInput = document.getElementById('profile-photo-input');
    const cancelButton = document.getElementById('profile-cancel-button');

    photoInput?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        ToastComponent.show('Use a PNG, JPG, or WebP image smaller than 2 MB.', 'error');
        photoInput.value = '';
        return;
      }
      this.avatarFile = file;
      const reader = new FileReader();
      reader.addEventListener('load', () => this.renderAvatar(document.getElementById('profile-full-name').value, reader.result));
      reader.readAsDataURL(file);
    });

    cancelButton?.addEventListener('click', () => this.populateProfile(user));
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const saveButton = document.getElementById('profile-save-button');
      const fullName = document.getElementById('profile-full-name').value.trim();
      if (!fullName) return;

      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
      try {
        const profile = await ProfileService.updateProfile(user.id, {
          fullName,
          department: document.getElementById('profile-department').value.trim(),
          phone: document.getElementById('profile-phone').value.trim(),
          office: document.getElementById('profile-office').value.trim(),
          avatarPath: user.avatarPath
        }, this.avatarFile);
        ToastComponent.show('Profile updated successfully.', 'success');
        await Router.navigate({
          ...user,
          fullName: profile.full_name,
          department: profile.department,
          phone: profile.phone,
          office: profile.office,
          avatarPath: profile.avatar_path,
          avatarUrl: ProfileService.getAvatarUrl(profile.avatar_path)
        }, ROUTES.PROFILE);
      } catch (error) {
        ToastComponent.show(error.message || 'Unable to update your profile.', 'error');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save profile';
      }
    });
  }
};
