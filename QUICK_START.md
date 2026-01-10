# Quick Start Guide

## Step 1: Install Dependencies

Open a terminal in the project directory and run:

```bash
npm install
```

This will install all required packages including React, Vite, TypeScript, and UI components.

## Step 2: Start the Development Server

Run the following command:

```bash
npm run dev
```

You should see output like:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

## Step 3: Open in Browser

Open your web browser and navigate to:

**http://localhost:5173**

## Step 4: Test the Features

1. **Sign Up/Login**: Create an account or login
2. **View Carousel**: The featured images carousel will auto-swipe every 5 seconds
3. **Check Header**: 
   - Click the bell icon for notifications
   - Use the role switcher if you have multiple roles
4. **Book an Event**: 
   - Click "Book Now" on any event card
   - Complete the booking flow
5. **Navigate**: Use the quick action cards to access different pages

## Troubleshooting

### Port Already in Use
If you see an error about port 5173 being in use, Vite will automatically use the next available port. Check the terminal for the actual URL.

### Module Not Found Errors
If you see import errors, make sure you've run `npm install` and all dependencies are installed.

### TypeScript Errors
The project uses strict TypeScript. Make sure all files are properly typed.

## What's New

✅ **Auto-Swipe Carousel**: Featured images automatically slide every 5 seconds
✅ **Integrated Header**: Notification panel and role switcher are now in the header
✅ **Event Booking**: Click "Book Now" on any event to start the booking process
✅ **Proper Project Structure**: All files organized and configured for Vite

## Next Steps

- Explore the different user roles (Super Admin, Sub Admin, Sub Editor, Public)
- Create and approve events
- Make bookings and check them in "My Pass"
- Test the notification system
- Try role switching (if you have multiple roles)




