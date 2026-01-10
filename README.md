# MyHainan App

A Progressive Web App (PWA) for the Hainan Association community, built with React, TypeScript, and Vite.

## Features

- **User Authentication**: Frontend-only authentication with localStorage
- **Role-Based Access**: Support for Super Admin, Sub Admin, Sub Editor, and Public users
- **Event Management**: Create, approve, and book events
- **Auto-Swipe Carousel**: Featured images carousel with automatic sliding
- **Event Booking**: Complete booking flow with payment methods
- **Notifications**: Real-time notification panel
- **Role Switcher**: Switch between multiple roles with verification
- **Gamification**: Points and badges system
- **Donations**: Donation tracking with badges
- **Loans**: Loan management system

## Project Structure

```
Hainan App/
├── components/          # React components
│   ├── AuthPage.tsx
│   ├── PublicHomePage.tsx
│   ├── EventBookingPage.tsx
│   ├── NotificationPanel.tsx
│   ├── RoleSwitcher.tsx
│   └── ...
├── ui/                  # UI components (shadcn/ui)
├── styles/              # CSS styles
├── supabase/            # Supabase configuration
├── App.tsx              # Main app component
├── AuthContext.tsx      # Authentication context
├── main.tsx             # Entry point
└── index.html           # HTML template
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** or **yarn** package manager

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd "C:\Users\ACER\Downloads\Hainan App"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   
   Or if you're using yarn:
   ```bash
   yarn install
   ```

## Running the Development Server

To start the development server with Vite:

```bash
npm run dev
```

Or with yarn:

```bash
yarn dev
```

The application will be available at:
- **Local**: `http://localhost:5173`
- **Network**: The terminal will display the network URL if you want to access it from other devices

## Viewing the Prototype

1. **Start the development server** (see above)

2. **Open your browser** and navigate to:
   ```
   http://localhost:5173
   ```

3. **Login or Sign Up:**
   - The app uses frontend-only authentication (localStorage)
   - Create a new account or use an existing one
   - You can switch roles using the Role Switcher in the header

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the project for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check for code issues

## Key Features Implementation

### Auto-Swipe Carousel
The featured images carousel automatically slides every 5 seconds. You can also manually navigate using the arrow buttons.

### Header Integration
- **NotificationPanel**: Click the bell icon to view notifications
- **RoleSwitcher**: Switch between available roles (if you have multiple roles)

### Event Booking
- Click "Book Now" on any event card
- Complete the 3-step booking process:
  1. Select number of attendees
  2. Choose payment method
  3. Enter payment details
- Bookings are saved to localStorage and appear in "My Pass"

## Data Storage

This app uses **localStorage** for all data persistence:
- User authentication
- Events
- Bookings
- Notifications
- Donations
- Loans

**Note**: All data is stored locally in your browser. Clearing browser data will reset everything.

## Technology Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Embla Carousel** - Carousel functionality
- **Lucide React** - Icons

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Port Already in Use
If port 5173 is already in use, Vite will automatically try the next available port. Check the terminal output for the actual URL.

### Dependencies Issues
If you encounter dependency issues:
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
Make sure all TypeScript types are properly imported. The project uses strict TypeScript configuration.

## Development Notes

- The app is designed as a frontend-only demo
- No backend API calls are made
- All data persists in localStorage
- The app works completely offline after initial load

## License

This project is for demonstration purposes.




