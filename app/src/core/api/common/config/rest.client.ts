// import { TokenService } from "@/core/services/token/token.service";
// import { SessionModel } from "@/src/features/users/domain/entities/Session";
// import axios from "axios";

// function RestClient(tokenService: TokenService) {
//   const instance = axios.create({
//     headers: {
//       "Content-Type": "application/json",
//     },
//   });

//   instance.interceptors.request.use(
//     async (config) => {
//       const session = await tokenService.getSessionFromStorage();
//       if (session) {
//         config.headers["Authorization"] = `Bearer ${session.access}`;
//       }

//       const controller = new AbortController();
//       config.signal = controller.signal;

//       if (config.data instanceof FormData) {
//         config.headers["Content-Type"] = "multipart/form-data";
//       }

//       return config;
//     },
//     (error) => {
//       return Promise.reject({ error });
//     }
//   );

//   instance.interceptors.response.use(
//     (response) => {
//       return response;
//     },
//     async (error) => {
//       const originalConfig = error.config;

//       if (error.response && error.response.status === 401) {
//         const session: SessionModel | null = await tokenService.getSessionFromStorage();
//         const refreshToken = session?.refresh;

//         if (!refreshToken) {
//           tokenService.removeSession();
//           window.location.href = "/autenticar";
//           return Promise.reject(error);
//         }

//         try {
//           const response = await axios.post(
//             `${process.env.BASE_URL}/api/v1/token/refresh/`,
//             { refresh: refreshToken }
//           );

//           const { access, refresh } = response.data;

//           const newSession: SessionModel = {
//             ...session!,
//             access: access,
//             refresh: refresh,
//           };

//           tokenService.setSessionInStorage(newSession);

//           originalConfig.headers["Authorization"] = `Bearer ${access}`;
//           return instance(originalConfig);
//         } catch (refreshError: any) {
//           if (
//             refreshError.response &&
//             refreshError.response.status === 401 &&
//             (refreshError.response.data["detail"] ===
//               "El token es inválido o ha expirado" ||
//               refreshError.response.data["detail"] ===
//                 "El token está en lista negra" ||
//               refreshError.response.data["detail"] ===
//                 "El token dado no es valido para ningun tipo de token")
//           ) {
//             tokenService.removeSession();
//             window.location.href = "/autenticar";
//           }
//           return Promise.reject(refreshError);
//         }
//       }

//       console.log(
//         "ERROR",
//         error,
//         "ERROR-DATA",
//         error.response?.data || error.message
//       );
//       return Promise.reject(error);
//     }
//   );

//   return instance;
// }

// export default RestClient;
