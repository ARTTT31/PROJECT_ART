import Swal from 'sweetalert2';

const sweetAlertClasses = {
  popup: 'art-swal-popup',
  title: 'art-swal-title',
  htmlContainer: 'art-swal-html',
  confirmButton: 'art-swal-confirm',
  cancelButton: 'art-swal-cancel',
  denyButton: 'art-swal-deny',
  actions: 'art-swal-actions',
  input: 'art-swal-input',
  loader: 'art-swal-loader',
};

const modalDefaults = {
  buttonsStyling: false,
  customClass: sweetAlertClasses,
};

// Gradient icon badge used by the notification dialogs (success / error / warning / info)
type AlertIcon = 'success' | 'error' | 'warning' | 'info';

const iconGlyphs: Record<AlertIcon, string> = {
  success: '<path d="M5.5 12.4l4.3 4.3 8.7-9.2" />',
  error: '<path d="M7.2 7.2l9.6 9.6" /><path d="M16.8 7.2l-9.6 9.6" />',
  warning: '<path d="M12 6.9v7.2" /><path d="M12 17.6h.01" />',
  info: '<path d="M12 11.1v7" /><path d="M12 7.2h.01" />',
};

const iconBadge = (type: AlertIcon) => ({
  icon: type,
  iconHtml: `<svg class="art-swal-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconGlyphs[type]}</svg>`,
  customClass: { ...sweetAlertClasses, icon: `art-swal-icon art-swal-icon-${type}` },
});

// Toast notification (มุมขวาบน)
export const showToast = (
  title: string,
  icon: 'success' | 'error' | 'warning' | 'info' = 'success',
) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    showCloseButton: false,
    timer: 3000,
    timerProgressBar: true,
    backdrop: false, // Prevents any dark background overlay behind the toast
    buttonsStyling: false,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  return Toast.fire({
    icon,
    title,
  });
};

// Success alert
export const showSuccess = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    ...iconBadge('success'),
    title,
    text,
    confirmButtonText: 'ตกลง',
  });
};

// Error alert
export const showError = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    ...iconBadge('error'),
    title,
    text,
    confirmButtonText: 'ตกลง',
  });
};

// Warning alert
export const showWarning = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    ...iconBadge('warning'),
    title,
    text,
    confirmButtonText: 'ตกลง',
  });
};

// Info alert
export const showInfo = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    ...iconBadge('info'),
    title,
    text,
    confirmButtonText: 'ตกลง',
  });
};

// Confirm dialog
export const showConfirm = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
  });
};

// Delete confirm
export const showDeleteConfirm = (title: string = 'คุณแน่ใจหรือไม่?', text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    customClass: {
      ...sweetAlertClasses,
      confirmButton: 'art-swal-confirm art-swal-danger',
    },
    icon: 'warning',
    title,
    text: text || 'คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ลบเลย!',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
  });
};

// Loading
export const showLoading = (title: string = 'กำลังโหลด...') => {
  Swal.fire({
    ...modalDefaults,
    title,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

// Close loading
export const closeLoading = () => {
  Swal.close();
};

// Input dialog
export const showInput = (
  title: string,
  inputPlaceholder: string = '',
  inputValue: string = '',
) => {
  return Swal.fire({
    ...modalDefaults,
    title,
    input: 'text',
    inputPlaceholder,
    inputValue,
    showCancelButton: true,
    confirmButtonText: 'ตกลง',
    cancelButtonText: 'ยกเลิก',
    inputValidator: (value) => {
      if (!value) {
        return 'กรุณากรอกข้อมูล!';
      }
    },
  });
};
