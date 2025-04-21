// First, before page is loaded, we need to check if the user is logged in
// and if not, redirect to the login page
const API_URL = 'http://localhost:3000/user/profile';
const UserProfile = {};

window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Fetch user profile data
  fetch(API_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Populate the profile page with user data
    UserProfile = data;
  })
  .catch(error => {
    console.error('Error fetching profile:', error);
    window.location.href = '/login.html';
  });
});