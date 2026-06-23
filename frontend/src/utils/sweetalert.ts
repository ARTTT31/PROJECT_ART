import Swal from 'sweetalert2'

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
}

const modalDefaults = {
  buttonsStyling: false,
  customClass: sweetAlertClasses,
}

// Toast notification (มุมขวาบน)
export const showToast = (title: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  const Toast = Swal.mixin({
    ...modalDefaults,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
  })

  Toast.fire({
    icon,
    title
  })
}

// Success alert
export const showSuccess = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    icon: 'success',
    title,
    text,
    confirmButtonText: 'ตกลง',
  })
}

// Error alert
export const showError = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    icon: 'error',
    title,
    text,
    confirmButtonText: 'ตกลง',
  })
}

// Warning alert
export const showWarning = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    icon: 'warning',
    title,
    text,
    confirmButtonText: 'ตกลง',
  })
}

// Info alert
export const showInfo = (title: string, text?: string) => {
  return Swal.fire({
    ...modalDefaults,
    icon: 'info',
    title,
    text,
    confirmButtonText: 'ตกลง',
  })
}

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
    reverseButtons: true
  })
}

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
    reverseButtons: true
  })
}

// Loading
export const showLoading = (title: string = 'กำลังโหลด...') => {
  Swal.fire({
    ...modalDefaults,
    title,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading()
    }
  })
}

// Close loading
export const closeLoading = () => {
  Swal.close()
}

// Input dialog
export const showInput = (title: string, inputPlaceholder: string = '', inputValue: string = '') => {
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
        return 'กรุณากรอกข้อมูล!'
      }
    }
  })
}
