import { UserRepository } from "../repository/user.repository.ts";

export class UserService {
  protected userRepository: UserRepository;
  constructor() {
    this.userRepository = new UserRepository();
  }
}
