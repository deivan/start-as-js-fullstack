import { Injectable } from '@nestjs/common';

export type User = any;

@Injectable()
export class UserService {
  private readonly users = [
    {
      userId: 1,
      username: 'admin',
      password: 'admin123', // Ha-Ha!
    },
    {
      userId: 2,
      username: 'bobdouble',
      password: '!q@w#e$r%t', // Wrong pass too, just pressed 1q2w3e4r5t with shift for numbers and hackers know about that way
    },
  ];

  async login(username: string, password: string): Promise<User | false> {
    let user = this.users.find(user => user.username === username);

    if (user && user.password === password) {
      const { password, ...result } = user; // this is a trick to remove password from the user object
      return result;
    } else {
      return false;
    }
  }
}
