/**
 * 足迹地图 - 认证页面JavaScript
 * 处理登录、注册、表单切换和验证等功能
 */

document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const switchFormBtn = document.getElementById('switchFormBtn');
    const switchText = document.getElementById('switchText');
    const loginStatus = document.getElementById('loginStatus');
    const registerStatus = document.getElementById('registerStatus');
    
    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    // 初始化表单显示
    if (mode === 'register') {
        showRegisterForm();
    } else {
        showLoginForm();
    }
    
    // 初始化表单事件监听
    initFormEvents();
    initPasswordToggles();
    applyDarkMode();
    
    /**
     * 初始化表单事件监听
     */
    function initFormEvents() {
        // 表单切换事件
        loginTab.addEventListener('click', showLoginForm);
        registerTab.addEventListener('click', showRegisterForm);
        switchFormBtn.addEventListener('click', toggleForm);
        
        // 表单提交事件
        loginForm.addEventListener('submit', handleLoginSubmit);
        registerForm.addEventListener('submit', handleRegisterSubmit);
    }
    
    /**
     * 显示登录表单
     */
    function showLoginForm() {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authTitle.textContent = '登录您的账户';
        authSubtitle.textContent = '欢迎回来，请输入您的登录信息';
        switchText.textContent = '还没有账户？';
        switchFormBtn.textContent = '创建账户';
        history.replaceState(null, '', '?mode=login');
    }
    
    /**
     * 显示注册表单
     */
    function showRegisterForm() {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        authTitle.textContent = '创建新账户';
        authSubtitle.textContent = '填写以下信息开始您的足迹之旅';
        switchText.textContent = '已有账户？';
        switchFormBtn.textContent = '登录';
        history.replaceState(null, '', '?mode=register');
    }
    
    /**
     * 切换表单显示
     */
    function toggleForm() {
        if (loginForm.classList.contains('hidden')) {
            showLoginForm();
        } else {
            showRegisterForm();
        }
    }
    
    /**
     * 初始化密码可见性切换
     */
    function initPasswordToggles() {
        const toggleButtons = document.querySelectorAll('.password-toggle');
        
        toggleButtons.forEach(button => {
            button.addEventListener('click', function() {
                const input = this.previousElementSibling;
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                
                // 更改图标
                if (type === 'text') {
                    this.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                    `;
                } else {
                    this.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                        </svg>
                    `;
                }
            });
        });
    }
    
    /**
     * 处理登录表单提交
     * @param {Event} event - 提交事件
     */
    async function handleLoginSubmit(event) {
        event.preventDefault();
        
        // 获取表单字段
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // 验证表单
        if (!validateLoginForm()) {
            return;
        }
        
        // 显示加载状态
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<div class="loader loader-sm mr-2"></div> 登录中...`;
        
        try {
            // 发送登录请求到后端API
            const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 登录成功
                // 保存用户会话到localStorage
                localStorage.setItem('footprintMapCurrentUser', JSON.stringify(data.user));
                localStorage.setItem('authToken', data.token);
                
                // 显示成功消息
                showStatus(loginStatus, '登录成功！正在跳转...', 'success');
                
                // 跳转到控制台页面
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                // 登录失败
                showStatus(loginStatus, `登录失败：${data.error}`, 'danger');
                
                // 恢复按钮状态
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        } catch (error) {
            console.error('登录请求错误:', error);
            showStatus(loginStatus, '登录失败：网络错误', 'danger');
            
            // 恢复按钮状态
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
    
    /**
     * 处理注册表单提交
     * @param {Event} event - 提交事件
     */
    async function handleRegisterSubmit(event) {
        event.preventDefault();
        
        // 获取表单字段
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;
        
        // 验证表单
        if (!validateRegisterForm()) {
            return;
        }
        
        // 显示加载状态
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<div class="loader loader-sm mr-2"></div> 注册中...`;
        
        try {
            // 发送注册请求到后端API
            const response = await fetch('http://127.0.0.1:5000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password, agreeTerms })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 注册成功
                // 保存用户会话到localStorage
                localStorage.setItem('footprintMapCurrentUser', JSON.stringify(data.user));
                localStorage.setItem('authToken', data.token);
                
                // 显示成功消息
                showStatus(registerStatus, '注册成功！正在跳转...', 'success');
                
                // 跳转到控制台页面
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                // 注册失败
                showStatus(registerStatus, `注册失败：${data.error}`, 'danger');
                
                // 如果是邮箱已被使用的错误，标记邮箱输入为无效
                if (data.error === 'Email already in use') {
                    const emailInput = document.getElementById('registerEmail');
                    markInvalid(emailInput);
                    emailInput.nextElementSibling.textContent = "此邮箱已被注册";
                }
                
                // 恢复按钮状态
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        } catch (error) {
            console.error('注册请求错误:', error);
            showStatus(registerStatus, '注册失败：网络错误', 'danger');
            
            // 恢复按钮状态
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
    
    /**
     * 验证登录表单
     * @returns {boolean} 表单是否有效
     */
    function validateLoginForm() {
        let isValid = true;
        
        // 验证邮箱
        const emailInput = document.getElementById('loginEmail');
        const emailValue = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailValue || !emailRegex.test(emailValue)) {
            markInvalid(emailInput);
            isValid = false;
        } else {
            markValid(emailInput);
        }
        
        // 验证密码
        const passwordInput = document.getElementById('loginPassword');
        const passwordValue = passwordInput.value.trim();
        
        if (!passwordValue) {
            markInvalid(passwordInput);
            isValid = false;
        } else {
            markValid(passwordInput);
        }
        
        return isValid;
    }
    
    /**
     * 验证注册表单
     * @returns {boolean} 表单是否有效
     */
    function validateRegisterForm() {
        let isValid = true;
        
        // 验证用户名
        const usernameInput = document.getElementById('registerUsername');
        const usernameValue = usernameInput.value.trim();
        
        if (!usernameValue || usernameValue.length < 3) {
            markInvalid(usernameInput);
            isValid = false;
        } else {
            markValid(usernameInput);
        }
        
        // 验证邮箱
        const emailInput = document.getElementById('registerEmail');
        const emailValue = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailValue || !emailRegex.test(emailValue)) {
            markInvalid(emailInput);
            isValid = false;
        } else {
            markValid(emailInput);
        }
        
        // 验证密码
        const passwordInput = document.getElementById('registerPassword');
        const passwordValue = passwordInput.value.trim();
        
        if (!passwordValue || passwordValue.length < 6) {
            markInvalid(passwordInput);
            isValid = false;
        } else {
            markValid(passwordInput);
        }
        
        // 验证确认密码
        const confirmInput = document.getElementById('confirmPassword');
        const confirmValue = confirmInput.value.trim();
        
        if (!confirmValue || confirmValue !== passwordValue) {
            markInvalid(confirmInput);
            isValid = false;
        } else {
            markValid(confirmInput);
        }
        
        // 验证同意条款
        const termsInput = document.getElementById('agreeTerms');
        const termsErrorMsg = document.querySelector('#agreeTerms').parentElement.nextElementSibling;
        
        if (!termsInput.checked) {
            termsErrorMsg.style.display = 'block';
            isValid = false;
        } else {
            termsErrorMsg.style.display = 'none';
        }
        
        return isValid;
    }
    
    /**
     * 标记表单输入为无效
     * @param {HTMLElement} input - 输入元素
     */
    function markInvalid(input) {
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
    }
    
    /**
     * 标记表单输入为有效
     * @param {HTMLElement} input - 输入元素
     */
    function markValid(input) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
    }
    
    /**
     * 显示状态消息
     * @param {HTMLElement} statusElement - 状态消息容器
     * @param {string} message - 要显示的消息
     * @param {string} type - 消息类型 (success, danger, warning, info)
     */
    function showStatus(statusElement, message, type) {
        statusElement.textContent = message;
        statusElement.className = `alert alert-${type} mt-4`;
        statusElement.classList.remove('hidden');
    }
    
    /**
     * 应用深色模式
     */
    function applyDarkMode() {
        // 检查用户偏好
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        }
        
        // 监听模式变化
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (event.matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        });
    }
    
    /**
     * 社交登录按钮事件
     */
    const socialButtons = document.querySelectorAll('.social-button');
    socialButtons.forEach(button => {
        button.addEventListener('click', function() {
            const provider = this.classList.contains('google') ? 'Google' : 
                             this.classList.contains('facebook') ? 'Facebook' : 'GitHub';
            
            alert(`${provider} 登录功能尚未实现`);
        });
    });
});