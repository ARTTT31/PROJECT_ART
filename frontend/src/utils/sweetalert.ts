import Swal from 'sweetalert2'

// Toast notification (มุมขวาบน)
export const showToast = (title: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  const Toast = Swal.mixin({
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
    icon: 'success',
    title,
    text,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#0ea5e9',
  })
}

// Error alert
export const showError = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#ef4444',
  })
}

// Warning alert
export const showWarning = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'warning',
    title,
    text,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#f59e0b',
  })
}

// Info alert
export const showInfo = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'info',
    title,
    text,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#0ea5e9',
  })
}

// Confirm dialog
export const showConfirm = (title: string, text?: string) => {
  return Swal.fire({
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0ea5e9',
    cancelButtonColor: '#64748b',
    reverseButtons: true
  })
}

// Delete confirm
export const showDeleteConfirm = (title: string = 'คุณแน่ใจหรือไม่?', text?: string) => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: text || 'คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ลบเลย!',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    reverseButtons: true
  })
}

// Loading
export const showLoading = (title: string = 'กำลังโหลด...') => {
  Swal.fire({
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
    title,
    input: 'text',
    inputPlaceholder,
    inputValue,
    showCancelButton: true,
    confirmButtonText: 'ตกลง',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0ea5e9',
    cancelButtonColor: '#64748b',
    inputValidator: (value) => {
      if (!value) {
        return 'กรุณากรอกข้อมูล!'
      }
    }
  })
}
